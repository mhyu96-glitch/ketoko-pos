import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Plus, 
  Check, 
  Phone, 
  Edit3, 
  Trash2, 
  MapPin, 
  Search,
  Table as TableIcon,
  LayoutGrid,
  Save,
  RotateCcw,
  QrCode,
  Lock,
  Wallet
} from 'lucide-react';
import { db } from '../db';
import type { Customer } from '../types';
import { syncService } from '../services/syncService';
import { lanService } from '../services/lanService';
import { formatRupiah } from '../services/escposService';
import { MemberCardModal } from './MemberCardModal';
import { MemberTopUpModal } from './MemberTopUpModal';
import { getStoredStores, type RegisteredStoreInfo } from '../services/storeRegistry';
import {
  checkCustomerBranchAccess,
  getCurrentActiveStoreId,
  getStoreDisplayName,
  normalizeAccessScope,
  normalizeStoreId,
  type CustomerAccessScope,
} from '../utils/customerAccess';
import { CustomerBranchBadge, CustomerBranchFields } from './CustomerBranchFields';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember?: (memberId: string, member?: Customer) => void;
  currentMemberId?: string;
}

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSelectMember,
  currentMemberId
}) => {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Customer[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    try {
      return (localStorage.getItem('ketoko_cust_view_mode') as 'table' | 'cards') || 'table';
    } catch {
      return 'table';
    }
  });

  // Cooperative multi-branch state
  const activeStoreId = getCurrentActiveStoreId();
  const [storesList, setStoresList] = useState<RegisteredStoreInfo[]>(() => getStoredStores());
  const [branchFilter, setBranchFilter] = useState<string>('ALL');

  // Add Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState<number>(1000000);
  const [newNotes, setNewNotes] = useState('');
  const [newStoreId, setNewStoreId] = useState<string>(() => getCurrentActiveStoreId());
  const [newAccessScope, setNewAccessScope] = useState<CustomerAccessScope>('ALL_STORES');

  // Edit Form State
  const [editingMember, setEditingMember] = useState<Customer | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState<number>(1000000);
  const [editNotes, setEditNotes] = useState('');
  const [editStoreId, setEditStoreId] = useState<string>('store-01');
  const [editAccessScope, setEditAccessScope] = useState<CustomerAccessScope>('ALL_STORES');

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Digital Card Modal State (QR & Barcode)
  const [selectedMemberForCard, setSelectedMemberForCard] = useState<Customer | null>(null);

  // Top Up Saldo Modal State
  const [selectedMemberForTopUp, setSelectedMemberForTopUp] = useState<Customer | null>(null);

  const toggleViewMode = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    try {
      localStorage.setItem('ketoko_cust_view_mode', mode);
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const loadMembers = async () => {
    try {
      let custs = await db.customers.toArray();
      setMembers(custs);

      // Sinkronisasi background dari LAN server jika aktif
      if (lanService.isLanActive()) {
        try {
          await lanService.fetchCustomersFromLan();
          custs = await db.customers.toArray();
          setMembers(custs);
        } catch (e) {
          console.warn('[MemberModal] LAN pull deferred:', e);
        }
      }

      // Sinkronisasi background dari Cloud jika online
      if (navigator.onLine) {
        try {
          await syncService.pullCustomersFromSupabase();
          custs = await db.customers.toArray();
          setMembers(custs);
        } catch (e) {
          console.warn('[MemberModal] Cloud pull deferred:', e);
        }
      }
    } catch (err) {
      console.error('Gagal memuat data member:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setEditingMember(null);
      setShowAddForm(false);
      setDeleteConfirmId(null);
    }

    const handleSync = () => {
      db.customers.toArray().then((custs) => {
        setMembers(custs);
      }).catch(() => {});
    };

    window.addEventListener('ketoko_customer_updated', handleSync);
    window.addEventListener('ketoko_customer_deleted', handleSync);
    window.addEventListener('ketoko_customers_synced', handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ketoko_customer_sync');
        bc.onmessage = () => {
          handleSync();
        };
      }
    } catch {}

    return () => {
      window.removeEventListener('ketoko_customer_updated', handleSync);
      window.removeEventListener('ketoko_customer_deleted', handleSync);
      window.removeEventListener('ketoko_customers_synced', handleSync);
      if (bc) bc.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Start Editing a Member
  const startEdit = (m: Customer) => {
    setStoresList(getStoredStores());
    setEditingMember(m);
    setEditCode(m.code || m.id);
    setEditName(m.name);
    setEditPhone(m.phone && m.phone !== '-' ? m.phone : '');
    setEditAddress(m.address && m.address !== '-' ? m.address : '');
    setEditCreditLimit(m.credit_limit || 0);
    setEditNotes(m.notes || '');
    setEditStoreId(normalizeStoreId(m.store_id));
    setEditAccessScope(normalizeAccessScope(m.access_scope));
    setShowAddForm(false);
    setDeleteConfirmId(null);
  };

  // Start Adding a New Member
  const startAdd = () => {
    setStoresList(getStoredStores());
    setShowAddForm(true);
    setEditingMember(null);
    setNewCode(`KOP-${String(members.length + 1).padStart(3, '0')}`);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewCreditLimit(1500000);
    setNewNotes('Karyawan Koperasi');
    setNewStoreId(getCurrentActiveStoreId());
    setNewAccessScope('ALL_STORES');
    setDeleteConfirmId(null);
  };

  // Save Edited Member
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim()) return;

    try {
      const targetStoreId = normalizeStoreId(editStoreId);
      const oldStoreId = normalizeStoreId(editingMember.store_id);
      const isBranchMoved = targetStoreId !== oldStoreId;

      const updatedMember: Customer = {
        ...editingMember,
        store_id: targetStoreId,
        store_name: getStoreDisplayName(targetStoreId),
        access_scope: normalizeAccessScope(editAccessScope),
        code: editCode.trim() || editingMember.code || `PLG-${Date.now().toString().slice(-4)}`,
        name: editName.trim(),
        phone: editPhone.trim() || '-',
        address: editAddress.trim() || '-',
        credit_limit: Number(editCreditLimit) || 0,
        notes: editNotes.trim(),
        updated_at: new Date().toISOString()
      };

      await syncService.syncCustomerChange(updatedMember);
      setMembers((prev) => prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)));
      
      // If this member is currently active in POS, update the selection (or revoke if mutated out)
      if (currentMemberId === updatedMember.id && onSelectMember) {
        onSelectMember(updatedMember.id, updatedMember);
      }

      setEditingMember(null);
      showToast(
        isBranchMoved
          ? `Mutasi berhasil: "${updatedMember.name}" dipindahkan ke ${getStoreDisplayName(targetStoreId)}!`
          : `Data pelanggan "${updatedMember.name}" berhasil disimpan!`
      );
    } catch (err) {
      console.error('Gagal menyimpan perubahan pelanggan:', err);
      showToast('Gagal menyimpan perubahan data pelanggan.');
    }
  };

  // Add New Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const newId = `cust-${Date.now()}`;
      const finalCode = newCode.trim() || `PLG-${String(members.length + 1).padStart(3, '0')}`;
      const targetStoreId = normalizeStoreId(newStoreId);
      const newMember: Customer = {
        id: newId,
        store_id: targetStoreId,
        store_name: getStoreDisplayName(targetStoreId),
        access_scope: normalizeAccessScope(newAccessScope),
        type: 'MEMBER',
        code: finalCode,
        name: newName.trim(),
        phone: newPhone.trim() || '-',
        address: newAddress.trim() || '-',
        credit_limit: Number(newCreditLimit) || 0,
        current_debt: 0,
        notes: newNotes.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await syncService.syncCustomerChange(newMember);
      setMembers((prev) => [newMember, ...prev.filter((m) => m.id !== newMember.id)]);
      setShowAddForm(false);
      showToast(`Karyawan/Pelanggan "${newMember.name}" (${getStoreDisplayName(targetStoreId)}) berhasil didaftarkan!`);
      setSelectedMemberForCard(newMember);
    } catch (err) {
      console.error('Gagal menambah pelanggan baru:', err);
      showToast('Gagal menambahkan pelanggan.');
    }
  };

  // Delete Member
  const handleDeleteMember = async (id: string) => {
    try {
      await syncService.deleteCustomer(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      if (currentMemberId === id && onSelectMember) {
        onSelectMember('');
      }
      setDeleteConfirmId(null);
      showToast('Pelanggan berhasil dihapus dari sistem.');
    } catch (err) {
      console.error('Gagal menghapus pelanggan:', err);
      showToast('Gagal menghapus pelanggan.');
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.phone || '').includes(search) ||
      (m.address || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (branchFilter === 'ALLOWED') {
      return checkCustomerBranchAccess(m, activeStoreId).allowed;
    }
    if (branchFilter !== 'ALL') {
      return normalizeStoreId(m.store_id) === branchFilter;
    }
    return true;
  });

  const handleSelectClick = (m: Customer) => {
    if (!onSelectMember) return;
    const access = checkCustomerBranchAccess(m, activeStoreId);
    if (!access.allowed) {
      showToast(access.reason || `Member "${m.name}" terdaftar di ${access.homeStoreName}`);
      return;
    }
    onSelectMember(m.id, m);
    onClose();
  };

  const activeSelected = members.find((m) => m.id === currentMemberId || m.code === currentMemberId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header - Warm Latte Gradient */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight tracking-tight text-white">Master Data Pelanggan & Member</h3>
              <p className="text-xs text-[#fcefe3] font-medium">Kelola kode unik, kontak WhatsApp, alamat domisili, dan limit piutang toko</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Feedback Banner */}
        {toastMessage && (
          <div className="bg-[#166534] text-white text-xs font-bold px-4 py-2 flex items-center justify-between animate-fadeIn shrink-0">
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="text-emerald-200 hover:text-white">✕</button>
          </div>
        )}

        {/* Toolbar & Search Bar */}
        <div className="px-4 py-3 border-b border-[#e4d5c7] bg-[#f5ece3] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          
          {/* Left: Total badge & View switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white text-[#543c2e] border border-[#dfcebe] text-xs font-bold shadow-2xs whitespace-nowrap">
              Total: {members.length} Pelanggan
            </span>

            {/* View Mode Switcher: Tabel vs Kartu */}
            <div className="flex items-center rounded-xl border border-[#dfcebe] bg-white overflow-hidden p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => toggleViewMode('table')}
                title="Tampilan Tabel Data"
                className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center space-x-1 transition-all ${
                  viewMode === 'table'
                    ? 'bg-[#7c4e2f] text-white shadow-2xs'
                    : 'text-[#856b59] hover:text-[#332219]'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => toggleViewMode('cards')}
                title="Tampilan Kartu"
                className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center space-x-1 transition-all ${
                  viewMode === 'cards'
                    ? 'bg-[#7c4e2f] text-white shadow-2xs'
                    : 'text-[#856b59] hover:text-[#332219]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kartu</span>
              </button>
            </div>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              title="Filter anggota berdasarkan cabang terdaftar"
              className="px-2.5 py-1.5 rounded-xl border border-[#dfcebe] bg-white text-xs font-bold text-[#543c2e] shadow-2xs focus:border-[#7c4e2f] max-w-[190px] truncate"
            >
              <option value="ALL">Semua Cabang ({members.length})</option>
              <option value="ALLOWED">Aktif di {getStoreDisplayName(activeStoreId)}</option>
              {storesList.map((s) => (
                <option key={s.id} value={s.id}>
                  Cabang: {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Search Input & Add Button */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative w-48 sm:w-60">
              <Search className="w-4 h-4 text-[#856b59] absolute left-3 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, kode, no. HP..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#dfcebe] text-xs focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20 bg-white font-medium"
              />
            </div>

            <button
              onClick={() => {
                if (showAddForm) {
                  setShowAddForm(false);
                } else {
                  startAdd();
                }
              }}
              className="px-3.5 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddForm ? 'Tutup Form' : '+ Pelanggan'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-[#f6f0ea] min-h-0">
          
          {/* Form Tambah Pelanggan Baru */}
          {showAddForm && !editingMember && (
            <form onSubmit={handleAddMember} className="p-4 bg-[#fcf5ed] border border-[#eed7c4] rounded-2xl space-y-3 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                <span className="text-xs font-black text-[#3d2617] flex items-center space-x-1.5">
                  <Plus className="w-4 h-4 text-[#7c4e2f]" />
                  <span>Form Input Pelanggan Baru</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Kode Pelanggan:</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="contoh: PLG-001"
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Nama Lengkap Pelanggan *:</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama pelanggan / toko..."
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-bold focus:border-[#7c4e2f]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">No. WhatsApp / Telepon:</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono focus:border-[#7c4e2f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Alamat Domisili:</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Alamat rumah / toko..."
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium focus:border-[#7c4e2f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Plafon Limit Piutang (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(Number(e.target.value))}
                    placeholder="1000000"
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Catatan Khusus:</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Keterangan tambahan..."
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium focus:border-[#7c4e2f]"
                  />
                </div>
              </div>

              <CustomerBranchFields
                storeId={newStoreId}
                onStoreIdChange={setNewStoreId}
                accessScope={newAccessScope}
                onAccessScopeChange={setNewAccessScope}
                stores={storesList}
              />

              <div className="flex justify-end space-x-2 pt-1 border-t border-[#eed7c4]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Pelanggan</span>
                </button>
              </div>
            </form>
          )}

          {/* Form Edit Pelanggan */}
          {editingMember && (
            <form onSubmit={handleSaveEdit} className="p-4 bg-[#fcf5ed] border-2 border-[#96633b] rounded-2xl space-y-3 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                <span className="text-xs font-black text-[#3d2617] flex items-center space-x-1.5">
                  <Edit3 className="w-4 h-4 text-[#96633b]" />
                  <span>Edit Data Pelanggan: <b className="text-[#96633b]">{editingMember.name}</b></span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Kode Pelanggan:</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Nama Lengkap Pelanggan *:</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-bold focus:border-[#7c4e2f]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">No. WhatsApp / Telepon:</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono focus:border-[#7c4e2f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Alamat Domisili:</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Alamat..."
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium focus:border-[#7c4e2f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Plafon Limit Piutang (Rp):</label>
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Catatan Khusus:</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Keterangan..."
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium focus:border-[#7c4e2f]"
                  />
                </div>
              </div>

              <CustomerBranchFields
                storeId={editStoreId}
                onStoreIdChange={setEditStoreId}
                accessScope={editAccessScope}
                onAccessScopeChange={setEditAccessScope}
                stores={storesList}
                originalStoreId={editingMember.store_id}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#eed7c4]">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForCard(editingMember)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs"
                  title="Lihat & Unduh Barcode Karyawan"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Lihat Barcode & Kartu</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-3.5 py-1.5 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* VIEW MODE 1: TABEL DATA PELANGGAN */}
          {viewMode === 'table' ? (
            <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
              <div className="overflow-x-auto max-h-[460px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                    <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                      <th className="py-3 px-4">Kode</th>
                      <th className="py-3 px-4">Nama Pelanggan</th>
                      <th className="py-3 px-4">Kontak & Alamat</th>
                      <th className="py-3 px-4 text-right">Saldo Member</th>
                      <th className="py-3 px-4 text-right">Plafon Piutang</th>
                      <th className="py-3 px-4 text-center">Aksi & Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e4d7] font-medium">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#856b59]">
                          <Users className="w-8 h-8 mx-auto text-[#dfcebe] mb-2" />
                          <p className="font-bold text-sm text-[#543c2e]">Belum ada data pelanggan</p>
                          <p className="text-xs text-[#856b59]">Klik tombol <b>+ Pelanggan</b> di atas untuk menambahkan.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => {
                        const isSelected = currentMemberId === m.id || currentMemberId === m.code;
                        const isConfirmingDelete = deleteConfirmId === m.id;
                        const access = checkCustomerBranchAccess(m, activeStoreId);

                        return (
                          <tr 
                            key={m.id} 
                            className={`transition-colors ${
                              isSelected ? 'bg-[#edf5ee]/70' : !access.allowed ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-[#fcf8f4]'
                            }`}
                          >
                            {/* Kode */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-lg bg-[#faebd7] text-[#7c4e2f] font-mono font-black text-xs border border-[#eed7c4]">
                                {m.code || m.id}
                              </span>
                            </td>

                            {/* Nama Pelanggan */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm flex items-center flex-wrap gap-1.5">
                                <span>{m.name}</span>
                                <CustomerBranchBadge customer={m} activeStoreId={activeStoreId} />
                                {isSelected && (
                                  <span className="text-[10px] bg-[#166534] text-white font-bold px-1.5 py-0.2 rounded-full inline-flex items-center space-x-0.5">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    <span>Dipilih di Kasir</span>
                                  </span>
                                )}
                              </div>
                              {m.notes && <div className="text-[11px] text-[#856b59] mt-0.5">{m.notes}</div>}
                            </td>

                            {/* Kontak & Alamat */}
                            <td className="py-3 px-4 whitespace-nowrap text-[#543c2e]">
                              <div className="flex items-center space-x-1 text-xs">
                                <Phone className="w-3.5 h-3.5 text-[#166534]" />
                                <span className="font-mono">{m.phone || '-'}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-[11px] text-[#856b59] mt-0.5 max-w-[240px] truncate">
                                <MapPin className="w-3.5 h-3.5 text-[#8c7766] shrink-0" />
                                <span className="truncate">{m.address || '-'}</span>
                              </div>
                            </td>

                            {/* Saldo Member */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-xs">
                                  {formatRupiah(Number(m.deposit_balance) || 0)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMemberForTopUp(m)}
                                  className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Top Up Saldo Anggota"
                                >
                                  <Wallet className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Plafon Piutang */}
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#332219] whitespace-nowrap">
                              {formatRupiah(m.credit_limit || 0)}
                            </td>

                            {/* Aksi (Pilih, Edit, Hapus) */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {isConfirmingDelete ? (
                                <div className="flex items-center justify-center space-x-1 animate-fadeIn">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMember(m.id)}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs"
                                  >
                                    Ya, Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2.5 py-1 text-[11px] font-medium bg-[#ebdccf] hover:bg-[#dfcebe] text-[#5c3c26] rounded-lg"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center space-x-1.5">
                                  {/* Tombol Pilih ke Kasir (Jika dibuka dalam konteks kasir POS) */}
                                  {onSelectMember && (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectClick(m)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all shadow-2xs ${
                                        !access.allowed
                                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200'
                                          : isSelected
                                            ? 'bg-[#166534] text-white hover:bg-[#14532d]'
                                            : 'bg-[#96633b] hover:bg-[#83532e] text-white'
                                      }`}
                                      title={
                                        !access.allowed
                                          ? `Terkunci: member ini hanya bisa bertransaksi di ${access.homeStoreName}`
                                          : isSelected
                                            ? 'Pelanggan ini sedang aktif di kasir'
                                            : 'Pilih pelanggan ini untuk nota kasir'
                                      }
                                    >
                                      {!access.allowed ? <Lock className="w-3 h-3" /> : <Check className="w-3 h-3 stroke-[2.5]" />}
                                      <span>{!access.allowed ? 'Terkunci' : isSelected ? 'Terpilih' : 'Pilih'}</span>
                                    </button>
                                  )}

                                  {/* Tombol Top Up Saldo */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMemberForTopUp(m)}
                                    className="px-2.5 py-1.5 rounded-xl text-emerald-900 bg-emerald-100 hover:bg-emerald-200 transition-colors border border-emerald-300 shadow-2xs flex items-center gap-1 font-bold text-xs cursor-pointer"
                                    title="Top Up Saldo Anggota"
                                  >
                                    <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                                    <span className="hidden md:inline">Top Up</span>
                                  </button>

                                  {/* Tombol Lihat & Cetak Kartu Member (QR & Barcode) */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMemberForCard(m)}
                                    className="px-2.5 py-1.5 rounded-xl text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-300 shadow-2xs flex items-center gap-1.5 font-bold text-xs"
                                    title="Buat, Simpan Gambar Barcode (PNG) & Kirim ke WA Karyawan"
                                  >
                                    <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                                    <span className="hidden md:inline">Barcode & Kartu</span>
                                  </button>

                                  {/* Tombol Edit */}
                                  <button
                                    type="button"
                                    onClick={() => startEdit(m)}
                                    className="p-1.5 rounded-lg text-[#856b59] hover:text-[#7c4e2f] hover:bg-[#faebd7] transition-colors"
                                    title="Edit data pelanggan"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Tombol Hapus */}
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(m.id)}
                                    className="p-1.5 rounded-lg text-[#a08573] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Hapus pelanggan"
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
            </div>
          ) : (
            /* VIEW MODE 2: KARTU PELANGGAN */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredMembers.length === 0 ? (
                <div className="col-span-full py-12 text-center text-[#856b59] bg-white rounded-2xl border border-[#e4d5c7]">
                  <Users className="w-8 h-8 mx-auto text-[#dfcebe] mb-2" />
                  <p className="font-bold text-sm text-[#543c2e]">Belum ada data pelanggan</p>
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const isSelected = currentMemberId === m.id || currentMemberId === m.code;
                  const isConfirmingDelete = deleteConfirmId === m.id;
                  const access = checkCustomerBranchAccess(m, activeStoreId);

                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-[#edf5ee] border-[#166534] ring-2 ring-[#166534]/20 shadow-xs'
                          : !access.allowed
                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 shadow-2xs'
                            : 'bg-white border-[#e5d0be] hover:border-[#b8957c] shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-sm text-[#3d2617]">{m.name}</span>
                            <span className="text-[10px] font-mono bg-[#f5ebe0] text-[#96633b] px-2 py-0.5 rounded-md border border-[#ddc3aa] font-bold">
                              {m.code || m.id}
                            </span>
                            <CustomerBranchBadge customer={m} activeStoreId={activeStoreId} />
                          </div>
                          {m.notes && <div className="text-[11px] text-[#856b59] mt-0.5">{m.notes}</div>}
                          
                          <div className="mt-2 space-y-1 text-xs text-[#543c2e]">
                            <div className="flex items-center space-x-1 font-mono">
                              <Phone className="w-3.5 h-3.5 text-[#166534]" />
                              <span>{m.phone || '-'}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-[11px] text-[#856b59]">
                              <MapPin className="w-3.5 h-3.5 text-[#8c7766]" />
                              <span>{m.address || '-'}</span>
                            </div>
                            <div className="text-[11px] text-[#7c4e2f] font-bold">
                              Limit: <span className="font-mono">{formatRupiah(m.credit_limit || 0)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions in Card */}
                        <div className="flex flex-col items-end space-y-2 shrink-0">
                          {onSelectMember && (
                            <button
                              type="button"
                              onClick={() => handleSelectClick(m)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all shadow-xs ${
                                !access.allowed
                                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200'
                                  : isSelected
                                    ? 'bg-[#166534] text-white'
                                    : 'bg-[#96633b] hover:bg-[#83532e] text-white'
                              }`}
                            >
                              {!access.allowed ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              <span>{!access.allowed ? 'Terkunci' : isSelected ? 'Terpilih' : 'Pilih'}</span>
                            </button>
                          )}

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setSelectedMemberForCard(m)}
                              className="px-2 py-1.5 rounded-xl text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center gap-1 font-bold text-xs shadow-2xs"
                              title="Buat, Simpan Gambar Barcode (PNG) & Kirim ke WA Karyawan"
                            >
                              <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Kartu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(m)}
                              className="p-1.5 rounded-lg text-[#856b59] hover:bg-[#faebd7]"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(m.id)}
                              className="p-1.5 rounded-lg text-[#a08573] hover:text-rose-600 hover:bg-rose-50"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Delete confirmation in card */}
                      {isConfirmingDelete && (
                        <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                          <span className="text-rose-800 font-bold">Hapus pelanggan ini?</span>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.id)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-lg"
                            >
                              Ya
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2.5 py-1 text-[11px] font-medium bg-stone-200 text-stone-700 rounded-lg"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer: Selected Member in POS Indicator */}
        {activeSelected && onSelectMember && (
          <div className="px-4 py-2.5 bg-[#edf5ee] border-t border-[#cce2cf] text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 text-[#166534]">
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                Pelanggan aktif di kasir: <b>{activeSelected.name}</b> ({activeSelected.code || activeSelected.id})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectMember('', undefined);
                showToast('Pilihan member telah dibatalkan');
              }}
              className="px-3 py-1 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Batalkan Pilihan Kasir</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Digital Card & Cetak Barcode/QR Member */}
      <MemberCardModal
        isOpen={!!selectedMemberForCard}
        member={selectedMemberForCard}
        onClose={() => setSelectedMemberForCard(null)}
        onApplyToPos={onSelectMember}
      />

      {/* Modal Top Up Saldo Anggota */}
      {selectedMemberForTopUp && (
        <MemberTopUpModal
          isOpen={!!selectedMemberForTopUp}
          member={selectedMemberForTopUp}
          activeStoreId={activeStoreId}
          onClose={() => setSelectedMemberForTopUp(null)}
          onTopUpSuccess={(updatedCust) => {
            setMembers((prev) => prev.map(m => m.id === updatedCust.id ? updatedCust : m));
            showToast(`Top Up untuk "${updatedCust.name}" berhasil! Saldo baru: ${formatRupiah(updatedCust.deposit_balance || 0)}`);
          }}
        />
      )}
    </div>
  );
};
