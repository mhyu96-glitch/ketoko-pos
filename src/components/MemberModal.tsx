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
  Wallet,
  Smartphone,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  CheckCircle2,
  Printer,
  KeyRound,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { db } from '../db';
import type { Customer } from '../types';
import { syncService } from '../services/syncService';
import { lanService } from '../services/lanService';
import { employeeAllowanceService } from '../services/employeeAllowanceService';
import { formatRupiah, formatNominalDots, parseNominalDots } from '../services/escposService';
import { MemberCardModal } from './MemberCardModal';
import { MemberTopUpModal } from './MemberTopUpModal';
import { type RegisteredStoreInfo } from '../services/storeRegistry';
import {
  checkCustomerBranchAccess,
  clampEmployeeAllowance,
  clampEmployeeBalance,
  formatCustomerAddressDisplay,
  getCurrentActiveStoreId,
  getStoreDisplayName,
  getStoresForCluster,
  filterCustomersForStore,
  isCustomerBelongsToStoreOrCluster,
  normalizeAccessScope,
  normalizeStoreId,
  parseEmployeeMeta,
  preserveCustomerSecurityMetadata,
  removeEmployeePinFromAddress,
  setCustomerCardBlocked,
  isCustomerCardBlocked,
  hashEmployeePin,
  setEmployeePinInAddress,
  type CustomerAccessScope,
} from '../utils/customerAccess';
import { CustomerBranchBadge, CustomerBranchFields } from './CustomerBranchFields';
import { CustomSelect } from './CustomSelect';

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
  const [storesList, setStoresList] = useState<RegisteredStoreInfo[]>(() => getStoresForCluster(activeStoreId));
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [memberTypeFilter, setMemberTypeFilter] = useState<'ALL' | 'KARYAWAN' | 'MEMBER'>('ALL');
  const [unitAfdFilter, setUnitAfdFilter] = useState<string>('ALL');
  const [visibleLimit, setVisibleLimit] = useState<number>(150);

  // Batch Physical Card Printing Modal (For Employees Without Smartphones)
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [printUnitFilter, setPrintUnitFilter] = useState<string>('ALL');
  const [printAfdFilter, setPrintAfdFilter] = useState<string>('ALL');
  const [printBatchIndex, setPrintBatchIndex] = useState<number>(0);

  // Employee Portal Share & Reset States
  const [showSharePortalModal, setShowSharePortalModal] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Add Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<Customer['type']>('KARYAWAN');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState<number>(1000000);
  const [newAllowance, setNewAllowance] = useState<number>(2000000);
  const [newInitialDeposit, setNewInitialDeposit] = useState<number>(2000000);
  const [newNotes, setNewNotes] = useState('');
  const [newStoreId, setNewStoreId] = useState<string>(() => getCurrentActiveStoreId());
  const [newAccessScope, setNewAccessScope] = useState<CustomerAccessScope>('ALL_STORES');

  // Edit Form State
  const [editingMember, setEditingMember] = useState<Customer | null>(null);
  const [editType, setEditType] = useState<Customer['type']>('KARYAWAN');
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState<number>(1000000);
  const [editAllowance, setEditAllowance] = useState<number>(2000000);
  const [editDepositBalance, setEditDepositBalance] = useState<number>(2000000);
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
      setMembers(filterCustomersForStore(custs, activeStoreId));

      // Sinkronisasi background dari LAN server jika aktif
      if (lanService.isLanActive()) {
        try {
          await lanService.fetchCustomersFromLan(activeStoreId);
          custs = await db.customers.toArray();
          setMembers(filterCustomersForStore(custs, activeStoreId));
        } catch (e) {
          console.warn('[MemberModal] LAN pull deferred:', e);
        }
      }

      // Sinkronisasi background dari Cloud jika online
      if (navigator.onLine) {
        try {
          await syncService.pullCustomersFromSupabase();
          custs = await db.customers.toArray();
          setMembers(filterCustomersForStore(custs, activeStoreId));
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
        setMembers(filterCustomersForStore(custs, activeStoreId));
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
    setStoresList(getStoresForCluster(activeStoreId));
    setEditingMember(m);
    setEditType((m.type as any) || 'KARYAWAN');
    setEditCode(m.code || m.id);
    setEditName(m.name);
    setEditPhone(m.phone && m.phone !== '-' ? m.phone : '');
    setEditAddress(formatCustomerAddressDisplay(m.address) !== '-' ? formatCustomerAddressDisplay(m.address) : '');
    setEditCreditLimit(m.credit_limit || 0);
    setEditAllowance(Math.min(2000000, m.monthly_allowance !== undefined ? m.monthly_allowance : (m.type === 'KARYAWAN' ? 2000000 : 0)));
    setEditDepositBalance(Math.min(2000000, m.deposit_balance !== undefined ? m.deposit_balance : (m.type === 'KARYAWAN' ? 2000000 : 0)));
    setEditNotes(m.notes || '');
    setEditStoreId(normalizeStoreId(m.store_id || activeStoreId));
    setEditAccessScope(normalizeAccessScope(m.access_scope));
    setShowAddForm(false);
    setDeleteConfirmId(null);
  };

  // Start Adding a New Member
  const startAdd = () => {
    setStoresList(getStoresForCluster(activeStoreId));
    setShowAddForm(true);
    setEditingMember(null);
    setNewType('KARYAWAN');
    setNewCode(`KOP-${String(members.length + 1).padStart(3, '0')}`);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewCreditLimit(1500000);
    setNewAllowance(2000000);
    setNewInitialDeposit(2000000);
    setNewNotes('Karyawan Koperasi');
    setNewStoreId(getCurrentActiveStoreId());
    setNewAccessScope('ALL_STORES');
    setDeleteConfirmId(null);
  };

  // Reset Semua Karyawan ke Rp 2.000.000
  const handleResetAllEmployees = async () => {
    const totalEmp = members.filter(m => m.type === 'KARYAWAN').length;
    if (totalEmp === 0) {
      showToast('Tidak ada karyawan yang terdaftar (tipe KARYAWAN).');
      return;
    }
    const confirmWord = window.prompt(
      `⚠️ PERINGATAN RESET MASSAL (${totalEmp} Karyawan)\n\nKetik "RESET" (huruf besar) untuk mereset saldo kuota seluruh karyawan kembali ke Rp 2.000.000.\n\n(Tips: Jika terjadi salah reset, klik tombol "🛠️ Pulihkan Saldo" untuk mengembalikan sisa saldo sesuai riwayat transaksi bulan ini).`
    );
    if (!confirmWord || confirmWord.trim().toUpperCase() !== 'RESET') {
      return;
    }
    setIsResettingAll(true);
    try {
      const res = await employeeAllowanceService.resetEmployeeAllowance();
      if (res.success) {
        await loadMembers();
        showToast(`Berhasil! Saldo kuota ${res.count || totalEmp} karyawan telah direset ke Rp 2.000.000.`);
      } else {
        showToast('Gagal reset kuota: ' + (res.message || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      showToast('Gagal mereset saldo: ' + (err.message || ''));
    } finally {
      setIsResettingAll(false);
    }
  };

  // Pulihkan Saldo Semua Karyawan dari Riwayat Transaksi Bulan Ini (Atasi salah klik Reset)
  const handleRestoreAllBalancesFromTrx = async () => {
    if (
      !window.confirm(
        '🛠️ PULIHKAN SALDO DARI RIWAYAT TRANSAKSI BULAN INI\n\nSistem akan menghitung ulang:\nSisa Saldo = Plafon Rp 2.000.000 - Total Belanja Potong Saldo Bulan Ini\nberdasarkan nota transaksi kasir yang tercatat, lalu memulihkan saldo karyawan.\n\nLanjutkan pemulihan saldo?'
      )
    ) {
      return;
    }
    setIsResettingAll(true);
    try {
      const res = await employeeAllowanceService.recalculateBalancesFromTransactions();
      await loadMembers();
      showToast(`✅ ${res.message}`);
    } catch (err: any) {
      showToast('Gagal memulihkan saldo: ' + (err.message || ''));
    } finally {
      setIsResettingAll(false);
    }
  };

  // Reset / Pulihkan 1 Karyawan Tertentu
  const handleResetSingleEmployee = async (m: Customer) => {
    const targetAmt = Math.min(2000000, m.monthly_allowance || 2000000);
    const choice = window.prompt(
      `Pilih aksi saldo untuk "${m.name}" (${m.code || m.id}):\n- Saldo Saat Ini: ${formatRupiah(Number(m.deposit_balance) || 0)}\n\nKetik "1" untuk PULIHKAN Saldo sesuai potongan transaksi bulan ini (Atasi salah reset)\nKetik "2" untuk RESET PENUH ke ${formatRupiah(targetAmt)}`,
      '1'
    );
    if (!choice) return;
    if (choice.trim() === '1') {
      try {
        const res = await employeeAllowanceService.recalculateBalancesFromTransactions(m.id);
        await loadMembers();
        showToast(`✅ Saldo "${m.name}" berhasil dipulihkan dari transaksi bulan ini! (${res.message})`);
      } catch (err: any) {
        showToast('Gagal memulihkan saldo: ' + (err.message || ''));
      }
      return;
    }
    if (choice.trim() !== '2') return;
    try {
      const res = await employeeAllowanceService.resetEmployeeAllowance(m.id, targetAmt);
      if (res.success) {
        await loadMembers();
        showToast(`Saldo kuota "${m.name}" berhasil direset ke ${formatRupiah(targetAmt)}!`);
      } else {
        showToast('Gagal reset: ' + (res.message || 'Error'));
      }
    } catch (err: any) {
      showToast('Error saat reset kuota: ' + (err.message || ''));
    }
  };

  // Reset PIN Portal Karyawan (Jika karyawan lupa PIN)
  const handleResetPinEmployee = async (m: Customer) => {
    const meta = parseEmployeeMeta(m);
    if (!meta.has_pin) {
      showToast(`Karyawan "${m.name}" belum membuat PIN di portal HP.`);
      return;
    }

    if (
      !confirm(
        `Reset PIN Portal untuk "${m.name}" (NIK: ${m.code || m.id})?\n\nPIN lama akan dihapus. Saat karyawan membuka link portal di HP, karyawan akan diminta membuat 6-digit PIN baru.`
      )
    ) {
      return;
    }

    try {
      const updated = removeEmployeePinFromAddress(m);
      await db.customers.put(updated);
      await syncService.syncCustomerChange(updated, { allowPinRemoval: true });
      setMembers((prev) => prev.map((item) => (item.id === m.id ? updated : item)));
      showToast(`PIN untuk "${m.name}" berhasil di-reset! Karyawan dapat membuat PIN baru di HP.`);
    } catch (err: any) {
      showToast('Gagal me-reset PIN: ' + (err?.message || 'Error'));
    }
  };

  // Toggle Blokir Kartu Hilang (Opsi 4)
  const handleToggleBlockCard = async (m: Customer) => {
    const isCurrentlyBlocked = isCustomerCardBlocked(m);
    const confirmPrompt = isCurrentlyBlocked
      ? `Buka blokir kartu belanja untuk "${m.name}" (NIK: ${m.code || m.id})?\n\nSetelah dibuka, kartu ini dapat digunakan kembali untuk pembayaran saldo di kasir.`
      : `⚠️ BLOKIR KARTU HILANG:\n\nApakah Anda yakin ingin memblokir kartu "${m.name}" (NIK: ${m.code || m.id})?\n\nKartu yang diblokir TIDAK AKAN BISA digunakan untuk transaksi saldo di kasir sampai dibuka kembali oleh kasir/admin.`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      const updatedCustomer = setCustomerCardBlocked(m, !isCurrentlyBlocked);
      await db.customers.put(updatedCustomer);
      await syncService.syncCustomerChange(updatedCustomer, { allowBlockChange: true });
      setMembers((prev) => prev.map((item) => (item.id === updatedCustomer.id ? updatedCustomer : item)));
      showToast(
        !isCurrentlyBlocked
          ? `🚫 Kartu "${m.name}" DIBLOKIR! Transaksi kasir untuk kartu ini telah dinonaktifkan.`
          : `✅ Kartu "${m.name}" DIBUKA! Kartu dapat digunakan kembali di kasir.`
      );
    } catch (err: any) {
      console.error('Gagal mengubah status blokir kartu:', err);
      showToast('Gagal mengubah status blokir kartu.');
    }
  };

  // Set / Ubah 6-Digit PIN oleh Kasir (Opsi 1)
  const handleSetPinByCashier = async (m: Customer) => {
    const inputPin = window.prompt(
      `🔑 SET / UBAH PIN KARYAWAN:\n\nMasukkan 6 digit angka PIN baru untuk:\nNama: ${m.name}\nNIK: ${m.code || m.id}\n\n(PIN ini digunakan saat belanja saldo atau login portal digital):`
    );

    if (inputPin === null) return;
    const cleanPin = inputPin.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      alert('❌ Gagal: PIN harus berupa 6 angka (contoh: 123456).');
      return;
    }

    try {
      const salt = (m.code || m.id).toLowerCase();
      const pinHash = await hashEmployeePin(cleanPin, salt);
      const updatedCustomer = setEmployeePinInAddress(m, pinHash);
      await db.customers.put(updatedCustomer);
      await syncService.syncCustomerChange(updatedCustomer);
      setMembers((prev) => prev.map((item) => (item.id === updatedCustomer.id ? updatedCustomer : item)));
      showToast(`✅ PIN untuk karyawan "${m.name}" berhasil diatur (${cleanPin})!`);
    } catch (err: any) {
      console.error('Gagal mengatur PIN karyawan:', err);
      showToast('Gagal mengatur PIN karyawan.');
    }
  };

  // Save Edited Member
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim()) return;

    try {
      const targetStoreId = normalizeStoreId(editStoreId);
      const oldStoreId = normalizeStoreId(editingMember.store_id);
      const isBranchMoved = targetStoreId !== oldStoreId;

      const updatedMember = preserveCustomerSecurityMetadata(
        {
          ...editingMember,
          store_id: targetStoreId,
          store_name: getStoreDisplayName(targetStoreId),
          access_scope: normalizeAccessScope(editAccessScope),
          type: editType,
          code: editCode.trim() || editingMember.code || `PLG-${Date.now().toString().slice(-4)}`,
          name: editName.trim(),
          phone: editPhone.trim() || '-',
          address: formatCustomerAddressDisplay(editAddress.trim() || '-'),
          credit_limit: editType === 'KARYAWAN' ? clampEmployeeAllowance(editAllowance) : (Number(editCreditLimit) || 0),
          monthly_allowance: editType === 'KARYAWAN' ? Math.min(2000000, Math.max(0, Number(editAllowance) || 2000000)) : undefined,
          deposit_balance: editType === 'KARYAWAN' ? Math.min(2000000, Math.max(0, Number(editDepositBalance) || 0)) : (Number(editDepositBalance) || 0),
          notes: editNotes.trim(),
          updated_at: new Date().toISOString()
        },
        editingMember
      );

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
          : `Data ${updatedMember.type === 'KARYAWAN' ? 'karyawan' : 'pelanggan'} "${updatedMember.name}" berhasil disimpan!`
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
      const finalCode = newCode.trim() || `KOP-${String(members.length + 1).padStart(3, '0')}`;
      const targetStoreId = normalizeStoreId(newStoreId);
      const newMember: Customer = {
        id: newId,
        store_id: targetStoreId,
        store_name: getStoreDisplayName(targetStoreId),
        access_scope: normalizeAccessScope(newAccessScope),
        type: newType,
        code: finalCode,
        name: newName.trim(),
        phone: newPhone.trim() || '-',
        address: newAddress.trim() || '-',
        credit_limit: Number(newCreditLimit) || 0,
        current_debt: 0,
        monthly_allowance: newType === 'KARYAWAN' ? Math.min(2000000, Math.max(0, Number(newAllowance) || 2000000)) : undefined,
        deposit_balance: newType === 'KARYAWAN' ? Math.min(2000000, Math.max(0, Number(newInitialDeposit) || 2000000)) : 0,
        last_allowance_reset: newType === 'KARYAWAN' ? new Date().toISOString().slice(0, 7) : undefined,
        notes: newNotes.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await syncService.syncCustomerChange(newMember);
      setMembers((prev) => [newMember, ...prev.filter((m) => m.id !== newMember.id)]);
      setShowAddForm(false);
      showToast(`${newMember.type === 'KARYAWAN' ? 'Karyawan' : 'Pelanggan'} "${newMember.name}" (${getStoreDisplayName(targetStoreId)}) berhasil didaftarkan!`);
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

  const unitAfdOptions = Array.from(
    new Set(
      members
        .filter((m) => m.type === 'KARYAWAN')
        .map((m) => {
          const meta = parseEmployeeMeta(m);
          return `${meta.unit_profile} • Afd ${meta.afdeling}`;
        })
    )
  ).sort();

  const printUnitOptions = Array.from(
    new Set(members.filter((m) => m.type === 'KARYAWAN').map((m) => parseEmployeeMeta(m).unit_profile))
  ).sort();

  const printAfdOptions = Array.from(
    new Set(
      members
        .filter((m) => m.type === 'KARYAWAN')
        .filter((m) => printUnitFilter === 'ALL' || parseEmployeeMeta(m).unit_profile === printUnitFilter)
        .map((m) => parseEmployeeMeta(m).afdeling)
    )
  ).sort();

  const filteredMembers = members.filter((m) => {
    // Isolasi ketat: Pelanggan/karyawan harus berada dalam cluster toko aktif!
    if (!isCustomerBelongsToStoreOrCluster(m.store_id, activeStoreId)) {
      return false;
    }

    const q = search.toLowerCase();
    const cleanAddr = formatCustomerAddressDisplay(m.address).toLowerCase();
    const matchesSearch =
      !q ||
      (m.name || '').toLowerCase().includes(q) ||
      (m.code || '').toLowerCase().includes(q) ||
      (m.id || '').toLowerCase().includes(q) ||
      (m.phone || '').includes(search) ||
      cleanAddr.includes(q);

    if (!matchesSearch) return false;

    if (memberTypeFilter === 'KARYAWAN') {
      if (m.type !== 'KARYAWAN') return false;
    } else if (memberTypeFilter === 'MEMBER') {
      if (m.type === 'KARYAWAN') return false;
    }

    if (unitAfdFilter !== 'ALL') {
      const meta = parseEmployeeMeta(m);
      if (`${meta.unit_profile} • Afd ${meta.afdeling}` !== unitAfdFilter) return false;
    }

    if (branchFilter === 'ALLOWED') {
      return checkCustomerBranchAccess(m, activeStoreId).allowed;
    }
    if (branchFilter !== 'ALL') {
      return normalizeStoreId(m.store_id) === branchFilter;
    }
    return true;
  });

  const displayedMembers = filteredMembers.slice(0, visibleLimit);

  const batchPrintCandidates = members
    .filter((m) => isCustomerBelongsToStoreOrCluster(m.store_id, activeStoreId) && m.type === 'KARYAWAN')
    .filter((m) => {
      const meta = parseEmployeeMeta(m);
      if (printUnitFilter !== 'ALL' && meta.unit_profile !== printUnitFilter) return false;
      if (printAfdFilter !== 'ALL' && meta.afdeling !== printAfdFilter) return false;
      return true;
    });

  const BATCH_PRINT_SIZE = 60;
  const totalPrintBatches = Math.max(1, Math.ceil(batchPrintCandidates.length / BATCH_PRINT_SIZE));
  const safeBatchIndex = Math.min(printBatchIndex, totalPrintBatches - 1);
  const selectedPrintSlice = batchPrintCandidates.slice(
    safeBatchIndex * BATCH_PRINT_SIZE,
    (safeBatchIndex + 1) * BATCH_PRINT_SIZE
  );

  const handlePrintPhysicalCardsA4 = (targetCards: Customer[]) => {
    if (!targetCards || targetCards.length === 0) {
      showToast('Tidak ada data karyawan pada filter yang dipilih.');
      return;
    }
    const printWin = window.open('', '_blank', 'width=980,height=760');
    if (!printWin) {
      alert('Pop-up diblokir oleh browser. Izinkan pop-up untuk mencetak lembar kartu fisik A4.');
      return;
    }

    const storeTitle = activeStoreId.startsWith('store-koperasimsl')
      ? 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI'
      : getStoreDisplayName(activeStoreId).toUpperCase();

    const cardsData = targetCards.map((c) => {
      const meta = parseEmployeeMeta(c);
      return {
        name: c.name,
        code: c.code || c.id,
        unit: meta.unit_profile,
        afd: meta.afdeling,
        job: meta.job_code !== '-' ? meta.job_code : ''
      };
    });

    printWin.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Cetak Kartu Fisik Karyawan (${cardsData.length} Kartu)</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <style>
    @page { size: A4 portrait; margin: 7mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #0f172a; }
    .toolbar { padding: 10px 16px; background: #064e3b; color: #fff; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
    .toolbar button { background: #fbbf24; color: #0f172a; border: none; padding: 7px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; }
    @media print { .toolbar { display: none !important; } }
    .sheet {
      display: grid;
      grid-template-columns: repeat(2, 86mm);
      justify-content: center;
      gap: 4mm 6mm;
      padding-top: 2mm;
    }
    .card {
      width: 86mm;
      height: 54mm;
      border: 1.2px dashed #64748b;
      border-radius: 3.5mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .card-head {
      background: linear-gradient(135deg, #022c22 0%, #065f46 100%);
      color: #ffffff;
      padding: 2.2mm 3.2mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-head .brand { font-size: 6.8pt; font-weight: 900; letter-spacing: 0.2px; line-height: 1.15; }
    .card-head .sub { font-size: 5.5pt; color: #a7f3d0; font-weight: 600; }
    .card-head .pill { background: #fbbf24; color: #1e293b; font-size: 5.5pt; font-weight: 900; padding: 0.7mm 1.6mm; border-radius: 1.5mm; white-space: nowrap; }
    .card-body {
      padding: 2mm 3.2mm 1mm 3.2mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 2mm;
      flex: 1;
    }
    .emp-info { flex: 1; min-width: 0; }
    .emp-name { font-size: 9pt; font-weight: 900; color: #0f172a; line-height: 1.15; margin-bottom: 0.8mm; word-break: break-word; }
    .emp-nik { font-family: 'Courier New', monospace; font-size: 8pt; font-weight: 900; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; display: inline-block; padding: 0.4mm 1.4mm; border-radius: 1mm; }
    .emp-meta { font-size: 6.5pt; color: #334155; font-weight: 700; margin-top: 1mm; }
    .emp-quota { font-size: 6pt; color: #047857; font-weight: 800; margin-top: 0.7mm; }
    .qr-wrap { width: 17mm; height: 17mm; border: 1px solid #e2e8f0; border-radius: 1.5mm; padding: 0.8mm; display: flex; align-items: center; justify-content: center; shrink: 0; }
    .qr-wrap canvas { width: 100% !important; height: 100% !important; }
    .card-foot {
      padding: 1mm 3mm 2mm 3mm;
      border-top: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #f8fafc;
    }
    .barcode-svg { width: 76mm; height: 9.5mm; }
    .foot-note { font-size: 5.3pt; color: #475569; font-weight: 700; margin-top: 0.4mm; }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><b>🖨️ Siap Cetak ${cardsData.length} Kartu Belanja Fisik (Ukuran Standar KTP/ATM 86×54mm)</b> — Gunting mengikuti garis putus-putus lalu laminating.</div>
    <button onclick="window.print()">Cetak Sekarang (Ctrl+P)</button>
  </div>
  <div class="sheet" id="cardsRoot"></div>
  <script>
    const items = ${JSON.stringify(cardsData)};
    const storeTitle = ${JSON.stringify(storeTitle)};
    const root = document.getElementById('cardsRoot');

    items.forEach((emp, idx) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = \`
        <div class="card-head">
          <div>
            <div class="brand">\${storeTitle}</div>
            <div class="sub">KARTU BELANJA KARYAWAN • UTAMA & CABANG MILL</div>
          </div>
          <span class="pill">KARTU FISIK</span>
        </div>
        <div class="card-body">
          <div class="emp-info">
            <div class="emp-name">\${emp.name}</div>
            <div class="emp-nik">\${emp.code}</div>
            <div class="emp-meta">\${emp.unit} • Afd \${emp.afd}\${emp.job ? ' • ' + emp.job : ''}</div>
            <div class="emp-quota">Plafon Maks Rp 2.000.000/Bln (Auto-Reset Tgl 1)</div>
          </div>
          <div class="qr-wrap"><canvas id="qr_\${idx}"></canvas></div>
        </div>
        <div class="card-foot">
          <svg id="bc_\${idx}" class="barcode-svg"></svg>
          <div class="foot-note">Tunjukkan kartu ini ke Kasir untuk scan pembayaran potong saldo</div>
        </div>
      \`;
      root.appendChild(div);

      try {
        JsBarcode('#bc_' + idx, emp.code, {
          format: 'CODE128',
          width: 1.45,
          height: 32,
          displayValue: false,
          margin: 0
        });
      } catch (e) {}

      try {
        if (window.QRCode) {
          QRCode.toCanvas(document.getElementById('qr_' + idx), emp.code, { width: 64, margin: 0 });
        }
      } catch (e) {}
    });

    window.onload = function() {
      setTimeout(function() { window.print(); }, 650);
    };
  </script>
</body>
</html>`);
    printWin.document.close();
  };

  const portalPublicUrl = (() => {
    if (typeof window === 'undefined') return 'https://koperasiMSL.ketokopos.online/karyawan';
    const h = window.location.hostname || 'localhost';
    if (h.includes('ketokopos.online')) {
      return `${window.location.origin}/karyawan`;
    }
    if (window.location.port === '5858') {
      return `http://${h}:5858/karyawan`;
    }
    return `https://koperasiMSL.ketokopos.online/karyawan`;
  })();

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
    <div className="fixed inset-0 z-50 bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
        
        {/* Header - Full-Screen Workspace */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c] hidden sm:flex">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-xl leading-tight tracking-tight text-white">Master Data Pelanggan & Member</h3>
              <p className="text-xs text-[#fcefe3] font-medium hidden sm:block">Kelola kode unik, kontak WhatsApp, alamat domisili, dan limit piutang toko</p>
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

            <CustomSelect
              value={branchFilter}
              onChange={(val) => setBranchFilter(val)}
              size="sm"
              title="Filter anggota berdasarkan cabang terdaftar"
              className="min-w-[175px] max-w-[220px]"
              options={[
                { value: 'ALL', label: `Semua Cabang (${members.length})` },
                { value: 'ALLOWED', label: `Aktif di ${getStoreDisplayName(activeStoreId)}` },
                ...storesList.map((s) => ({
                  value: s.id,
                  label: `Cabang: ${s.name}`,
                })),
              ]}
            />

            {/* Filter Jenis: Karyawan vs Member Biasa */}
            <CustomSelect
              value={memberTypeFilter}
              onChange={(val) => {
                setMemberTypeFilter(val as any);
                setVisibleLimit(150);
              }}
              size="sm"
              variant="emerald"
              title="Filter Anggota: Karyawan Koperasi atau Member Umum"
              className="min-w-[215px]"
              options={[
                { value: 'ALL', label: `Semua Anggota (${members.length})` },
                {
                  value: 'KARYAWAN',
                  label: `👔 Karyawan (${members.filter((m) => m.type === 'KARYAWAN').length})`,
                },
                {
                  value: 'MEMBER',
                  label: `🛒 Member Biasa (${members.filter((m) => m.type !== 'KARYAWAN').length})`,
                },
              ]}
            />

            {unitAfdOptions.length > 1 && (
              <CustomSelect
                value={unitAfdFilter}
                onChange={(val) => {
                  setUnitAfdFilter(val);
                  setVisibleLimit(150);
                }}
                size="sm"
                title="Filter Unit Kebun & Afdeling"
                className="min-w-[195px] max-w-[240px]"
                options={[
                  { value: 'ALL', label: 'Semua Unit / Afdeling' },
                  ...unitAfdOptions.map((opt) => ({ value: opt, label: opt })),
                ]}
              />
            )}

            {/* Tombol Bagikan Link Portal Kartu HP Karyawan */}
            <button
              type="button"
              onClick={() => setShowSharePortalModal(true)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-all whitespace-nowrap active:scale-95"
              title="Buka Link Portal Kartu HP untuk Karyawan"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
              <span>📱 Link Kartu HP</span>
            </button>

            {/* Tombol Cetak Kartu Fisik Massal untuk Karyawan Tanpa HP */}
            <button
              type="button"
              onClick={() => {
                setPrintBatchIndex(0);
                setShowBatchPrintModal(true);
              }}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-all whitespace-nowrap active:scale-95"
              title="Cetak Kartu Belanja Fisik (Kertas A4 / Laminating) untuk Karyawan yang Tidak Punya HP"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-200" />
              <span>🖨️ Cetak Kartu Fisik (Tanpa HP)</span>
            </button>

            {/* Tombol Pulihkan Saldo dari Transaksi (Atasi Salah Reset) */}
            <button
              type="button"
              onClick={handleRestoreAllBalancesFromTrx}
              disabled={isResettingAll}
              className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-all whitespace-nowrap active:scale-95 disabled:opacity-50"
              title="Pulihkan / hitung ulang sisa saldo seluruh karyawan dari nota transaksi bulan ini (Atasi salah klik Reset)"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-sky-200 ${isResettingAll ? 'animate-spin' : ''}`} />
              <span>🛠️ Pulihkan Saldo</span>
            </button>

            {/* Tombol Reset Kuota Bulanan Semua Karyawan */}
            <button
              type="button"
              onClick={handleResetAllEmployees}
              disabled={isResettingAll}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-all whitespace-nowrap active:scale-95 disabled:opacity-50"
              title="Reset saldo kuota seluruh karyawan menjadi Rp 2.000.000 (Wajib ketik RESET)"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-200 ${isResettingAll ? 'animate-spin' : ''}`} />
              <span>{isResettingAll ? 'Memproses...' : '🔄 Reset Saldo Rp 2 Jt'}</span>
            </button>
          </div>

          {/* Right: Search Input & Add Button */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative w-48 sm:w-60">
              <Search className="w-4 h-4 text-[#856b59] absolute left-3 top-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, NIK/kode, no. HP..."
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
              <span>{showAddForm ? 'Tutup Form' : '+ Karyawan / Member'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-[#f6f0ea] min-h-0">
          
          {/* Form Tambah Pelanggan / Karyawan Baru */}
          {showAddForm && !editingMember && (
            <form onSubmit={handleAddMember} className="p-4 bg-[#fcf5ed] border border-[#eed7c4] rounded-2xl space-y-3 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                <span className="text-xs font-black text-[#3d2617] flex items-center space-x-1.5">
                  <Plus className="w-4 h-4 text-[#7c4e2f]" />
                  <span>Form Pendaftaran Karyawan / Pelanggan Baru</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Pilihan Jenis Anggota */}
              <div className="p-2.5 bg-white border border-[#e5d0be] rounded-xl flex items-center gap-4 text-xs font-bold">
                <span className="text-[#543c2e]">Tipe Akun:</span>
                <label className="flex items-center space-x-1.5 cursor-pointer text-emerald-800">
                  <input
                    type="radio"
                    name="new_member_type"
                    value="KARYAWAN"
                    checked={newType === 'KARYAWAN'}
                    onChange={() => setNewType('KARYAWAN')}
                    className="accent-emerald-700"
                  />
                  <span>👔 Karyawan Koperasi (Plafon Rp 2 Jt/Bulan)</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer text-[#543c2e]">
                  <input
                    type="radio"
                    name="new_member_type"
                    value="MEMBER"
                    checked={newType === 'MEMBER'}
                    onChange={() => setNewType('MEMBER')}
                    className="accent-[#7c4e2f]"
                  />
                  <span>🛒 Pelanggan Biasa / Member Toko</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">NIK / Kode Member *:</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="contoh: NIK-10023 / KOP-001"
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Nama Lengkap *:</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama lengkap karyawan..."
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-bold focus:border-[#7c4e2f]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">No. WhatsApp / HP (Untuk Login Portal HP) *:</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono focus:border-[#7c4e2f]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {newType === 'KARYAWAN' ? (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-800 block mb-1">Plafon Kuota Bulanan (Maks Rp 2 Juta):</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNominalDots(newAllowance)}
                        onChange={(e) => setNewAllowance(clampEmployeeAllowance(parseNominalDots(e.target.value)))}
                        placeholder="2.000.000"
                        className="w-full px-3 py-1.5 text-xs border border-emerald-400 bg-emerald-50 rounded-xl font-mono font-bold text-emerald-900 focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-emerald-700">Maks Rp 2.000.000 • Reset otomatis tiap Tanggal 1</span>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-800 block mb-1">Saldo Awal Saat Didaftarkan (Maks Rp 2 Juta):</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNominalDots(newInitialDeposit)}
                        onChange={(e) => setNewInitialDeposit(clampEmployeeBalance(parseNominalDots(e.target.value)))}
                        placeholder="2.000.000"
                        className="w-full px-3 py-1.5 text-xs border border-emerald-400 bg-emerald-50 rounded-xl font-mono font-bold text-emerald-900 focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-emerald-700">Bisa langsung dibelanjakan di kasir</span>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Plafon Limit Piutang Kasir (Rp):</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNominalDots(newCreditLimit)}
                      onChange={(e) => setNewCreditLimit(parseNominalDots(e.target.value))}
                      placeholder="1.000.000"
                      className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Departemen / Divisi / Catatan:</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Divisi Operasional / Staff..."
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
                  <span>Simpan Data</span>
                </button>
              </div>
            </form>
          )}

          {/* Form Edit Pelanggan / Karyawan */}
          {editingMember && (
            <form onSubmit={handleSaveEdit} className="p-4 bg-[#fcf5ed] border-2 border-[#96633b] rounded-2xl space-y-3 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                <span className="text-xs font-black text-[#3d2617] flex items-center space-x-1.5">
                  <Edit3 className="w-4 h-4 text-[#96633b]" />
                  <span>Edit Data: <b className="text-[#96633b]">{editingMember.name}</b></span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tipe Akun Edit */}
              <div className="p-2.5 bg-white border border-[#e5d0be] rounded-xl flex items-center gap-4 text-xs font-bold">
                <span className="text-[#543c2e]">Tipe Akun:</span>
                <label className="flex items-center space-x-1.5 cursor-pointer text-emerald-800">
                  <input
                    type="radio"
                    name="edit_member_type"
                    value="KARYAWAN"
                    checked={editType === 'KARYAWAN'}
                    onChange={() => setEditType('KARYAWAN')}
                    className="accent-emerald-700"
                  />
                  <span>👔 Karyawan Koperasi</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer text-[#543c2e]">
                  <input
                    type="radio"
                    name="edit_member_type"
                    value="MEMBER"
                    checked={editType === 'MEMBER'}
                    onChange={() => setEditType('MEMBER')}
                    className="accent-[#7c4e2f]"
                  />
                  <span>🛒 Pelanggan Biasa / Toko</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">NIK / Kode Pelanggan:</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Nama Lengkap *:</label>
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
                {editType === 'KARYAWAN' ? (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-800 block mb-1">Plafon Kuota Bulanan (Maks Rp 2 Jt):</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNominalDots(editAllowance)}
                        onChange={(e) => setEditAllowance(clampEmployeeAllowance(parseNominalDots(e.target.value)))}
                        className="w-full px-3 py-1.5 text-xs border border-emerald-400 bg-emerald-50 rounded-xl font-mono font-bold text-emerald-900 focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-800 block mb-1">Sisa Saldo Saat Ini (Maks Rp 2 Jt):</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNominalDots(editDepositBalance)}
                        onChange={(e) => setEditDepositBalance(clampEmployeeBalance(parseNominalDots(e.target.value)))}
                        className="w-full px-3 py-1.5 text-xs border border-emerald-400 bg-emerald-50 rounded-xl font-mono font-bold text-emerald-900 focus:border-emerald-600"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Plafon Limit Piutang (Rp):</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNominalDots(editCreditLimit)}
                      onChange={(e) => setEditCreditLimit(parseNominalDots(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold focus:border-[#7c4e2f]"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-[#543c2e] block mb-1">Departemen / Catatan Khusus:</label>
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
            <div className="bg-white rounded-2xl border border-[#e4d5c7] shadow-xs overflow-hidden">
              <div className="overflow-x-auto max-h-[calc(100vh-235px)] custom-scroll">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#f1e5d8] z-10">
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
                      displayedMembers.map((m) => {
                        const isSelected = currentMemberId === m.id || currentMemberId === m.code;
                        const isConfirmingDelete = deleteConfirmId === m.id;
                        const access = checkCustomerBranchAccess(m, activeStoreId);
                        const meta = parseEmployeeMeta(m);

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
                                {m.type === 'KARYAWAN' && (
                                  <>
                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 shadow-2xs">
                                      👔 Karyawan
                                    </span>
                                    {meta.has_pin ? (
                                      <span className="px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[9.5px] font-bold border border-teal-300 shadow-2xs flex items-center gap-1" title="Karyawan sudah mengaktifkan 6-digit PIN keamanan">
                                        <KeyRound className="w-2.5 h-2.5 text-teal-700" />
                                        <span>PIN Aktif</span>
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[9.5px] font-semibold border border-stone-200" title="Karyawan belum membuat PIN di portal HP">
                                        ⚪ Belum PIN
                                      </span>
                                    )}
                                    {meta.is_blocked && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9.5px] font-black border border-rose-700 animate-pulse flex items-center gap-1 shadow-2xs" title="Kartu belanja ini dilaporkan hilang & sedang diblokir">
                                        <ShieldAlert className="w-2.5 h-2.5" />
                                        <span>🚫 KARTU DIBLOKIR / HILANG</span>
                                      </span>
                                    )}
                                  </>
                                )}
                                <CustomerBranchBadge customer={m} activeStoreId={activeStoreId} />
                                {isSelected && (
                                  <span className="text-[10px] bg-[#166534] text-white font-bold px-1.5 py-0.2 rounded-full inline-flex items-center space-x-0.5">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    <span>Dipilih di Kasir</span>
                                  </span>
                                )}
                              </div>
                              {m.notes && m.type !== 'KARYAWAN' && <div className="text-[11px] text-[#856b59] mt-0.5">{m.notes}</div>}
                            </td>

                            {/* Kontak & Alamat */}
                            <td className="py-3 px-4 whitespace-nowrap text-[#543c2e]">
                              <div className="flex items-center space-x-1.5 text-xs text-[#332219] font-medium max-w-[280px] truncate">
                                <MapPin className="w-3.5 h-3.5 text-[#8c7766] shrink-0" />
                                <span className="truncate">{formatCustomerAddressDisplay(m.address)}</span>
                              </div>
                              {m.phone && m.phone.trim() !== '-' && (
                                <div className="flex items-center space-x-1.5 text-[11px] text-[#856b59] mt-0.5 tabular-nums">
                                  <Phone className="w-3 h-3 text-[#166534] shrink-0" />
                                  <span>{m.phone}</span>
                                </div>
                              )}
                            </td>

                            {/* Saldo Member */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="text-right">
                                  <span className="tabular-nums font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-xs block">
                                    {formatRupiah(Number(m.deposit_balance) || 0)}
                                  </span>
                                  {m.type === 'KARYAWAN' && (
                                    <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5 tabular-nums">
                                      Plafon: {formatRupiah(m.monthly_allowance || 2000000)}/bln
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMemberForTopUp(m)}
                                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
                                  title="Top Up Saldo Anggota"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Plafon Piutang */}
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-[#332219] whitespace-nowrap">
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

                                  {/* Tombol Reset Kuota 1 Karyawan */}
                                  {m.type === 'KARYAWAN' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleResetSingleEmployee(m)}
                                        className="p-1.5 rounded-xl text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors border border-amber-300 shadow-2xs"
                                        title={`Reset saldo kuota ${m.name} ke ${formatRupiah(m.monthly_allowance || 2000000)}`}
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleResetPinEmployee(m)}
                                        className={`p-1.5 rounded-xl transition-colors border shadow-2xs ${
                                          meta.has_pin
                                            ? 'text-teal-900 bg-teal-100 hover:bg-teal-200 border-teal-300'
                                            : 'text-stone-400 bg-stone-100 border-stone-200 opacity-50 cursor-not-allowed'
                                        }`}
                                        title={meta.has_pin ? `Reset PIN portal karyawan untuk ${m.name}` : `${m.name} belum membuat PIN di portal HP`}
                                        disabled={!meta.has_pin}
                                      >
                                        <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                                      </button>

                                      {/* Tombol Set / Ubah PIN oleh Kasir (Opsi 1: Untuk karyawan tanpa HP / kartu fisik) */}
                                      <button
                                        type="button"
                                        onClick={() => handleSetPinByCashier(m)}
                                        className="px-2 py-1.5 rounded-xl text-teal-900 bg-teal-50 hover:bg-teal-100 transition-colors border border-teal-300 shadow-2xs font-bold text-[10px]"
                                        title={`Atur / Ubah PIN 6 digit untuk kartu ${m.name}`}
                                      >
                                        Set PIN
                                      </button>

                                      {/* Tombol Kunci / Blokir Kartu Hilang Instant (Opsi 4) */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleBlockCard(m)}
                                        className={`p-1.5 rounded-xl transition-colors border shadow-2xs ${
                                          meta.is_blocked
                                            ? 'text-white bg-rose-600 hover:bg-rose-700 border-rose-700 animate-pulse'
                                            : 'text-stone-600 bg-stone-100 hover:bg-rose-100 hover:text-rose-700 border-stone-300'
                                        }`}
                                        title={
                                          meta.is_blocked
                                            ? `Kartu ${m.name} sedang DIBLOKIR. Klik untuk membuka blokir.`
                                            : `Laporkan Kartu Hilang: Blokir kartu belanja ${m.name}`
                                        }
                                      >
                                        {meta.is_blocked ? (
                                          <ShieldAlert className="w-3.5 h-3.5 text-white" />
                                        ) : (
                                          <ShieldOff className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </>
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
              {filteredMembers.length > visibleLimit && (
                <div className="p-3 bg-[#faf5f0] border-t border-[#e4d5c7] flex items-center justify-between text-xs">
                  <span className="text-[#634837] font-medium">
                    Menampilkan <b>{displayedMembers.length}</b> dari <b>{filteredMembers.length}</b> anggota
                  </span>
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((prev) => prev + 250)}
                    className="px-3.5 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white font-bold rounded-xl shadow-2xs"
                  >
                    Tampilkan +250 Lagi
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* VIEW MODE 2: KARTU PELANGGAN */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[calc(100vh-235px)] overflow-y-auto pr-1 custom-scroll">
              {displayedMembers.length === 0 ? (
                <div className="col-span-full py-12 text-center text-[#856b59] bg-white rounded-2xl border border-[#e4d5c7]">
                  <Users className="w-8 h-8 mx-auto text-[#dfcebe] mb-2" />
                  <p className="font-bold text-sm text-[#543c2e]">Belum ada data pelanggan</p>
                </div>
              ) : (
                displayedMembers.map((m) => {
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
                            {m.type === 'KARYAWAN' && (
                              <>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                                  👔 Karyawan
                                </span>
                                {parseEmployeeMeta(m).has_pin ? (
                                  <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-md border border-teal-300 flex items-center gap-1" title="PIN portal aktif">
                                    <KeyRound className="w-2.5 h-2.5 text-teal-700" />
                                    <span>PIN Aktif</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-md border border-stone-200" title="Belum membuat PIN portal">
                                    ⚪ Belum PIN
                                  </span>
                                )}
                                {parseEmployeeMeta(m).is_blocked && (
                                  <span className="text-[10px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-md border border-rose-700 animate-pulse flex items-center gap-0.5 shadow-2xs" title="Kartu belanja ini dilaporkan hilang & sedang diblokir">
                                    <ShieldAlert className="w-2.5 h-2.5" />
                                    <span>DIBLOKIR</span>
                                  </span>
                                )}
                              </>
                            )}
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
                              <span>{formatCustomerAddressDisplay(m.address)}</span>
                            </div>
                            {m.type === 'KARYAWAN' ? (
                              <div className="text-[11px] text-emerald-900 font-bold bg-emerald-50 p-2 rounded-xl border border-emerald-200 mt-1">
                                <div>Saldo Kuota: <span className="font-mono">{formatRupiah(Number(m.deposit_balance) || 0)}</span></div>
                                <div className="text-[10px] text-emerald-700 font-medium">Plafon: {formatRupiah(m.monthly_allowance || 2000000)} / bln</div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#7c4e2f] font-bold">
                                Limit: <span className="font-mono">{formatRupiah(m.credit_limit || 0)}</span>
                              </div>
                            )}
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
                            {/* Tombol Reset Kuota 1 Karyawan di Card */}
                            {m.type === 'KARYAWAN' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleResetSingleEmployee(m)}
                                  className="p-1.5 rounded-xl text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 shadow-2xs"
                                  title={`Reset saldo kuota ${m.name} ke ${formatRupiah(m.monthly_allowance || 2000000)}`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetPinEmployee(m)}
                                  className={`p-1.5 rounded-xl border shadow-2xs ${
                                    parseEmployeeMeta(m).has_pin
                                      ? 'text-teal-900 bg-teal-100 hover:bg-teal-200 border-teal-300'
                                      : 'text-stone-400 bg-stone-100 border-stone-200 opacity-50 cursor-not-allowed'
                                  }`}
                                  title={parseEmployeeMeta(m).has_pin ? `Reset PIN portal karyawan untuk ${m.name}` : `${m.name} belum membuat PIN di portal HP`}
                                  disabled={!parseEmployeeMeta(m).has_pin}
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetPinByCashier(m)}
                                  className="px-1.5 py-1 rounded-xl text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-300 shadow-2xs font-bold text-[9.5px]"
                                  title={`Atur / Ubah PIN 6 digit untuk kartu ${m.name}`}
                                >
                                  Set PIN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleBlockCard(m)}
                                  className={`p-1.5 rounded-xl border shadow-2xs ${
                                    parseEmployeeMeta(m).is_blocked
                                      ? 'text-white bg-rose-600 hover:bg-rose-700 border-rose-700 animate-pulse'
                                      : 'text-stone-600 bg-stone-100 hover:bg-rose-100 hover:text-rose-700 border-stone-300'
                                  }`}
                                  title={
                                    parseEmployeeMeta(m).is_blocked
                                      ? `Kartu ${m.name} sedang DIBLOKIR. Klik untuk membuka blokir.`
                                      : `Laporkan Kartu Hilang: Blokir kartu belanja ${m.name}`
                                  }
                                >
                                  {parseEmployeeMeta(m).is_blocked ? (
                                    <ShieldAlert className="w-3.5 h-3.5 text-white" />
                                  ) : (
                                    <ShieldOff className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </>
                            )}

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

      {/* FULL-SCREEN WORKSPACE: Bagikan Link Portal Kartu HP Karyawan */}
      {showSharePortalModal && (
        <div className="fixed inset-0 z-[70] bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
          <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-6 lg:px-8 py-4 bg-gradient-to-r from-emerald-800 to-teal-700 text-white flex items-center justify-between shrink-0 border-b border-emerald-900">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-emerald-950/50 text-emerald-200 hidden sm:flex">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base sm:text-lg text-white">Portal Kartu Digital Karyawan (Via HP)</h4>
                  <p className="text-xs text-emerald-100">Cek Saldo & Barcode Belanja Langsung dari Browser HP</p>
                </div>
              </div>
              <button
                onClick={() => setShowSharePortalModal(false)}
                className="px-3.5 py-2 rounded-xl bg-emerald-950/50 hover:bg-emerald-950/80 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Tutup</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 text-xs text-stone-700">
              <div className="max-w-3xl mx-auto bg-white border border-[#e5d0be] rounded-3xl shadow-xs p-5 sm:p-7 space-y-5">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-sm text-emerald-950 block">Self-Service 100% Digital untuk Seluruh Karyawan</span>
                    <span className="text-xs text-emerald-800 leading-relaxed mt-0.5 block">
                      Karyawan yang memiliki HP tidak perlu antre kartu fisik. Cukup buka link di browser HP, verifikasi NIK + PIN, lalu tunjukkan barcode di kasir!
                    </span>
                  </div>
                </div>

                {/* Link Box */}
                <div>
                  <label className="text-xs font-extrabold text-stone-700 block mb-1.5">
                    Link Akses Portal Karyawan:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={portalPublicUrl}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold text-xs text-stone-800 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(portalPublicUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center space-x-1.5 shrink-0 transition-colors shadow-2xs"
                    >
                      {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Tersalin' : 'Salin Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(portalPublicUrl, '_blank');
                      }}
                      className="p-2.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 rounded-xl transition-colors shrink-0"
                      title="Buka di tab baru"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* WhatsApp Broadcast Template Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-stone-700 block">
                      Format Pesan WhatsApp Siap Sebar (Grup Karyawan):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const text = `*KARTU MEMBER DIGITAL KOPERASI KARYAWAN*\n\nHalo Rekan-rekan Karyawan,\n\nUntuk kemudahan berbelanja di Toko Utama maupun Toko Cabang Koperasi, kini kartu member dan kuota belanja bulanan Rp 2.000.000 sudah dapat diakses langsung via HP masing-masing!\n\n📲 *Link Portal Kartu Digital:*\n${portalPublicUrl}\n\n*Cara Menggunakannya:*\n1. Buka link di atas pada browser HP Anda.\n2. Masukkan NIK atau No. WhatsApp Anda.\n3. Kartu digital akan langsung tampil dengan Barcode Resmi & Sisa Kuota Belanja.\n4. Saat bayar di kasir, cukup tunjukkan barcode di layar HP Anda untuk di-scan oleh kasir.\n\n*Catatan:* Kuota belanja Rp 2.000.000 otomatis kereset tiap tanggal 1 awal bulan.\n\nTerima kasih & Selamat berbelanja!`;
                        navigator.clipboard.writeText(text);
                        setCopiedText(true);
                        setTimeout(() => setCopiedText(false), 2000);
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 hover:bg-emerald-100 flex items-center space-x-1.5"
                    >
                      {copiedText ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText ? 'Tersalin ke Clipboard!' : 'Salin Teks WA'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={9}
                    value={`*KARTU MEMBER DIGITAL KOPERASI KARYAWAN*\n\nHalo Rekan-rekan Karyawan,\n\nUntuk kemudahan berbelanja di Toko Utama maupun Toko Cabang Koperasi, kini kartu member dan kuota belanja bulanan Rp 2.000.000 sudah dapat diakses langsung via HP masing-masing!\n\n📲 *Link Portal Kartu Digital:*\n${portalPublicUrl}\n\n*Cara Menggunakannya:*\n1. Buka link di atas pada browser HP Anda.\n2. Masukkan NIK atau No. WhatsApp Anda.\n3. Kartu digital akan langsung tampil dengan Barcode Resmi & Sisa Kuota Belanja.\n4. Saat bayar di kasir, cukup tunjukkan barcode di layar HP Anda untuk di-scan oleh kasir.\n\n*Catatan:* Kuota belanja Rp 2.000.000 otomatis kereset tiap tanggal 1 awal bulan.\n\nTerima kasih & Selamat berbelanja!`}
                    className="w-full p-3.5 bg-stone-50 border border-stone-300 rounded-2xl font-mono text-xs text-stone-700 select-all leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN WORKSPACE: Cetak Kartu Fisik Massal (Kertas A4 / Standar ID Card) */}
      {showBatchPrintModal && (
        <div className="fixed inset-0 z-[70] bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
          <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-6 lg:px-8 py-4 bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-[#5e3519]">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 rounded-2xl bg-[#543017] text-amber-200 border border-[#9b663b]/50 hidden sm:flex">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-base sm:text-xl text-white">Cetak Kartu Fisik A4 Massal</h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#543017] text-amber-100 border border-[#9b663b]/50 uppercase">
                      85.6 × 54 mm (Standar KTP)
                    </span>
                  </div>
                  <p className="text-xs text-[#fcefe3] mt-0.5">
                    Cetak kartu belanja ber-barcode &amp; QR untuk karyawan yang tidak memiliki smartphone
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchPrintModal(false)}
                className="px-3.5 py-2 rounded-xl bg-[#543017] hover:bg-[#422511] text-white border border-[#9b663b]/50 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Tutup</span>
              </button>
            </div>

            {/* Spacious 2-Column Workspace Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-[#332219]">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Filter & Batch Grid (7 cols) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Info Banner */}
                  <div className="p-4 bg-white border border-[#e4d5c7] rounded-2xl flex items-start space-x-3 shadow-2xs">
                    <div className="p-2 rounded-xl bg-[#faebd7] text-[#7c4e2f] shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-extrabold text-sm text-[#332219] block">
                        Layout Presisi 2 Kolom per Lembar A4 (Siap Potong &amp; Laminating)
                      </span>
                      <span className="text-xs text-[#856b59] leading-relaxed mt-0.5 block">
                        Setiap kartu dilengkapi Barcode 1D (CODE128) &amp; QR Code tajam yang langsung membaca nama asli karyawan saat di-scan di kasir.
                      </span>
                    </div>
                  </div>

                  {/* Filter Unit & Afdeling */}
                  <div className="p-5 bg-white border border-[#e4d5c7] rounded-2xl shadow-2xs space-y-4">
                    <div className="font-extrabold text-sm text-[#332219]">1. Filter Unit &amp; Afdeling Karyawan</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#856b59] block mb-1.5">
                          Unit Kebun / Pabrik
                        </label>
                        <CustomSelect
                          value={printUnitFilter}
                          onChange={(val) => {
                            setPrintUnitFilter(val);
                            setPrintBatchIndex(0);
                          }}
                          options={[
                            { value: 'ALL', label: `Semua Unit (${batchPrintCandidates.length} Orang)` },
                            ...printUnitOptions.map((u) => ({ value: u, label: u })),
                          ]}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#856b59] block mb-1.5">
                          Afdeling / Divisi
                        </label>
                        <CustomSelect
                          value={printAfdFilter}
                          onChange={(val) => {
                            setPrintAfdFilter(val);
                            setPrintBatchIndex(0);
                          }}
                          options={[
                            { value: 'ALL', label: 'Semua Afdeling' },
                            ...printAfdOptions.map((afd) => ({ value: afd, label: afd })),
                          ]}
                        />
                      </div>
                    </div>

                    {/* 3 Summary KPI Boxes */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-[#fcf9f5] border border-[#eed7c4]">
                        <span className="text-[10px] font-bold uppercase text-[#8a6b53] block">Total Terfilter</span>
                        <span className="text-lg font-black tabular-nums text-[#332219] mt-0.5 block">
                          {batchPrintCandidates.length.toLocaleString('id-ID')} <span className="text-xs font-semibold text-[#8a6b53]">Org</span>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#fcf9f5] border border-[#eed7c4]">
                        <span className="text-[10px] font-bold uppercase text-[#8a6b53] block">Jumlah Batch</span>
                        <span className="text-lg font-black tabular-nums text-[#7c4e2f] mt-0.5 block">
                          {totalPrintBatches} <span className="text-xs font-semibold text-[#8a6b53]">Batch</span>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#fcf9f5] border border-[#eed7c4]">
                        <span className="text-[10px] font-bold uppercase text-[#8a6b53] block">Estimasi Kertas</span>
                        <span className="text-lg font-black tabular-nums text-emerald-800 mt-0.5 block">
                          {Math.max(1, Math.ceil(selectedPrintSlice.length / 10))} <span className="text-xs font-semibold text-[#8a6b53]">Lbr A4</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Clean Wrapping Batch Selector Grid */}
                  {totalPrintBatches > 1 && (
                    <div className="p-5 bg-white border border-[#e4d5c7] rounded-2xl shadow-2xs space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-sm text-[#332219]">
                            2. Pilih Batch Halaman ({BATCH_PRINT_SIZE} Kartu / Batch)
                          </div>
                          <div className="text-[11px] text-[#856b59]">
                            Dicetak per batch agar antrean printer tetap ringan &amp; rapi
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={safeBatchIndex <= 0}
                            onClick={() => setPrintBatchIndex(Math.max(0, safeBatchIndex - 1))}
                            className="p-1.5 rounded-lg border border-[#dfcebe] bg-[#fcf9f5] hover:bg-[#faebd7] text-[#543c2e] disabled:opacity-40 transition-colors"
                            title="Batch Sebelumnya"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-2.5 py-1 rounded-lg bg-[#faebd7] text-[#7c4e2f] font-black text-xs tabular-nums">
                            Batch {safeBatchIndex + 1} / {totalPrintBatches}
                          </span>
                          <button
                            type="button"
                            disabled={safeBatchIndex >= totalPrintBatches - 1}
                            onClick={() => setPrintBatchIndex(Math.min(totalPrintBatches - 1, safeBatchIndex + 1))}
                            className="p-1.5 rounded-lg border border-[#dfcebe] bg-[#fcf9f5] hover:bg-[#faebd7] text-[#543c2e] disabled:opacity-40 transition-colors"
                            title="Batch Berikutnya"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1 custom-scroll">
                        {Array.from({ length: totalPrintBatches }).map((_, idx) => {
                          const startNo = idx * BATCH_PRINT_SIZE + 1;
                          const endNo = Math.min((idx + 1) * BATCH_PRINT_SIZE, batchPrintCandidates.length);
                          const isSelected = safeBatchIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPrintBatchIndex(idx)}
                              className={`px-2.5 py-2 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                                  : 'bg-[#fcf9f5] border-[#dfcebe] text-[#332219] hover:bg-[#faebd7]/60 hover:border-[#96633b]'
                              }`}
                            >
                              <div className="font-extrabold text-xs">Batch {idx + 1}</div>
                              <div className={`text-[10px] tabular-nums ${isSelected ? 'text-amber-100' : 'text-[#8a6b53]'}`}>
                                No. {startNo}–{endNo}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Live Batch Preview List (5 cols) */}
                <div className="lg:col-span-5">
                  <div className="bg-white border border-[#e4d5c7] rounded-2xl shadow-2xs overflow-hidden flex flex-col h-full max-h-[540px]">
                    <div className="px-4 py-3.5 bg-[#f5ece3] border-b border-[#e4d5c7] flex items-center justify-between shrink-0">
                      <div>
                        <div className="font-extrabold text-xs sm:text-sm text-[#332219]">
                          Preview Daftar Kartu — Batch {safeBatchIndex + 1}
                        </div>
                        <div className="text-[11px] text-[#856b59]">
                          {selectedPrintSlice.length} karyawan siap dicetak pada batch ini
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black">
                        Siap Print
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-[#f5ece3] custom-scroll">
                      {selectedPrintSlice.length === 0 ? (
                        <div className="p-8 text-center text-[#8a6b53]">
                          Tidak ada data karyawan sesuai filter ini.
                        </div>
                      ) : (
                        selectedPrintSlice.map((emp, i) => {
                          const globalNumber = safeBatchIndex * BATCH_PRINT_SIZE + i + 1;
                          return (
                            <div key={emp.id} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-[#fcf9f5]">
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-[#332219] truncate">
                                  <span className="text-[#8a6b53] tabular-nums mr-1.5">{globalNumber}.</span>
                                  {emp.name}
                                </div>
                                <div className="text-[10px] text-[#856b59] font-mono truncate mt-0.5">
                                  {emp.code || emp.id}
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold bg-[#fcf5ed] text-[#7c4e2f] border border-[#eed7c4] px-2 py-0.5 rounded-md shrink-0 max-w-[140px] truncate">
                                {formatCustomerAddressDisplay(emp.address) || 'Karyawan'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="px-4 sm:px-6 lg:px-8 py-4 bg-white border-t border-[#e4d5c7] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#856b59] font-medium">
                Batch {safeBatchIndex + 1} siap dicetak ({selectedPrintSlice.length} kartu)
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {batchPrintCandidates.length > BATCH_PRINT_SIZE && (
                  <button
                    type="button"
                    onClick={() => handlePrintPhysicalCardsA4(batchPrintCandidates)}
                    className="px-4 py-2.5 bg-[#faebd7] hover:bg-[#ebdccf] text-[#7c4e2f] border border-[#ddc3aa] rounded-xl text-xs font-extrabold transition-colors"
                  >
                    Cetak Semua ({batchPrintCandidates.length.toLocaleString('id-ID')} Kartu)
                  </button>
                )}
                <button
                  type="button"
                  disabled={selectedPrintSlice.length === 0}
                  onClick={() => handlePrintPhysicalCardsA4(selectedPrintSlice)}
                  className="px-6 py-2.5 bg-[#7c4e2f] hover:bg-[#633e26] disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center space-x-2 active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Batch {safeBatchIndex + 1} ({selectedPrintSlice.length} Kartu)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
