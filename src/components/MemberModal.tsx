import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  Check, 
  Phone, 
  Edit3, 
  Trash2, 
  Percent, 
  MapPin, 
  Save, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { db } from '../db';
import type { Customer } from '../types';

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

  // Add Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDiscount, setNewDiscount] = useState<number>(5);
  const [newCreditLimit, setNewCreditLimit] = useState<number>(5000000);

  // Edit Form State
  const [editingMember, setEditingMember] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDiscount, setEditDiscount] = useState<number>(5);
  const [editCreditLimit, setEditCreditLimit] = useState<number>(5000000);
  const [editNotes, setEditNotes] = useState('');

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const loadMembers = async () => {
    try {
      const custs = await db.customers.toArray();
      if (custs.length > 0) {
        setMembers(custs);
      } else {
        const defaults: Customer[] = [
          { id: 'MBR-001', code: 'CUST-001', name: 'Budi Santoso', phone: '081234567890', address: 'Jl. Ahmad Yani No. 12', credit_limit: 5000000, current_debt: 0, discount_percent: 5, created_at: new Date().toISOString() },
          { id: 'MBR-002', code: 'CUST-002', name: 'Siti Rahmawati', phone: '085298765432', address: 'Jl. Merdeka No. 45', credit_limit: 3000000, current_debt: 0, discount_percent: 10, created_at: new Date().toISOString() },
          { id: 'MBR-003', code: 'CUST-003', name: 'Toko Kelontong Berkah', phone: '081345678901', address: 'Jl. Gajah Mada No. 8', credit_limit: 10000000, current_debt: 0, discount_percent: 5, created_at: new Date().toISOString() }
        ];
        await db.customers.bulkPut(defaults);
        setMembers(defaults);
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
  }, [isOpen]);

  if (!isOpen) return null;

  // Start Editing a Member
  const startEdit = (m: Customer) => {
    setEditingMember(m);
    setEditName(m.name);
    setEditPhone(m.phone || '');
    setEditAddress(m.address || '');
    setEditDiscount(typeof m.discount_percent === 'number' ? m.discount_percent : 5);
    setEditCreditLimit(m.credit_limit || 5000000);
    setEditNotes(m.notes || '');
    setShowAddForm(false);
    setDeleteConfirmId(null);
  };

  // Save Edited Member
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim()) return;

    try {
      const updatedMember: Customer = {
        ...editingMember,
        name: editName.trim(),
        phone: editPhone.trim() || '-',
        address: editAddress.trim() || 'Lokal',
        discount_percent: Math.max(0, Math.min(100, Number(editDiscount) || 0)),
        credit_limit: Number(editCreditLimit) || 0,
        notes: editNotes.trim()
      };

      await db.customers.put(updatedMember);
      setMembers((prev) => prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)));
      
      // If this member is currently active in POS, update the selection
      if (currentMemberId === updatedMember.id && onSelectMember) {
        onSelectMember(updatedMember.id, updatedMember);
      }

      setEditingMember(null);
      showToast(`Data member "${updatedMember.name}" & diskon ${updatedMember.discount_percent}% berhasil disimpan!`);
    } catch (err) {
      console.error('Gagal menyimpan perubahan member:', err);
      showToast('Gagal menyimpan perubahan data member.');
    }
  };

  // Add New Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const newId = `MBR-00${members.length + 1}`;
      const newMember: Customer = {
        id: newId,
        code: `CUST-00${members.length + 1}`,
        name: newName.trim(),
        phone: newPhone.trim() || '-',
        address: newAddress.trim() || 'Lokal',
        credit_limit: Number(newCreditLimit) || 5000000,
        current_debt: 0,
        discount_percent: Math.max(0, Math.min(100, Number(newDiscount) || 0)),
        created_at: new Date().toISOString()
      };

      await db.customers.put(newMember);
      setMembers((prev) => [newMember, ...prev]);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewDiscount(5);
      setShowAddForm(false);
      showToast(`Member baru "${newMember.name}" (Diskon ${newMember.discount_percent}%) berhasil didaftarkan!`);
    } catch (err) {
      console.error('Gagal menambah member baru:', err);
      showToast('Gagal menambahkan member.');
    }
  };

  // Delete Member
  const handleDeleteMember = async (id: string) => {
    try {
      await db.customers.delete(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      if (currentMemberId === id && onSelectMember) {
        onSelectMember('');
      }
      setDeleteConfirmId(null);
      showToast('Member berhasil dihapus dari sistem.');
    } catch (err) {
      console.error('Gagal menghapus member:', err);
      showToast('Gagal menghapus member.');
    }
  };

  const filteredMembers = members.filter((m) =>
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.id || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.phone || '').includes(search) ||
    (m.address || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header - Warm Latte */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Kelola Member & Diskon Pelanggan</h3>
              <p className="text-xs text-[#fcefe3]">Atur nama, nomor kontak, dan persentase potongan diskon belanja member</p>
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

        {/* Content Area */}
        <div className="p-4 overflow-y-auto space-y-3 bg-[#fcf9f5] flex-1">
          
          {/* Search Bar & Action Buttons */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nama, No. HP, ID Member, atau Alamat..."
              className="flex-1 px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b] shadow-2xs font-medium"
            />
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setEditingMember(null);
              }}
              className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>{showAddForm ? 'Tutup Form' : '+ Member Baru'}</span>
            </button>
          </div>

          {/* Form Edit Member & Diskon */}
          {editingMember && (
            <form onSubmit={handleSaveEdit} className="p-4 bg-white rounded-2xl border-2 border-[#96633b] space-y-3 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-[#faebd7] text-[#96633b]">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-xs text-[#3d2617]">Edit Member: {editingMember.name}</span>
                    <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f5ebe0] text-[#96633b] border border-[#ddc3aa]">
                      {editingMember.id}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="text-stone-400 hover:text-stone-700 text-xs font-bold"
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">Nama Lengkap Member *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] font-bold focus:bg-white focus:border-[#96633b]"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">No. WhatsApp / HP</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono focus:bg-white focus:border-[#96633b]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">Alamat / Wilayah</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Jl. Pahlawan No. 12"
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] focus:bg-white focus:border-[#96633b]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#166534] flex items-center space-x-1 mb-1">
                    <Percent className="w-3.5 h-3.5" />
                    <span>Persentase Diskon Member (%) *</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 bg-[#edf5ee] text-[#166534] rounded-xl border border-[#cce2cf] font-black text-sm text-center focus:bg-white"
                      required
                    />
                    <span className="font-bold text-stone-600">% Diskon</span>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center space-x-1.5 mt-1.5">
                    {[0, 3, 5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setEditDiscount(pct)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                          editDiscount === pct
                            ? 'bg-[#166534] text-white border-[#166534]'
                            : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">Limit Bon / Piutang (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono focus:bg-white focus:border-[#96633b]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">Catatan Khusus</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Pelanggan setia bengkel / toko"
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] focus:bg-white focus:border-[#96633b]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#eed7c4]">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan & Diskon</span>
                </button>
              </div>
            </form>
          )}

          {/* Form Tambah Member Baru */}
          {showAddForm && !editingMember && (
            <form onSubmit={handleAddMember} className="p-4 bg-white rounded-2xl border border-[#e5d0be] space-y-3 shadow-xs animate-fadeIn">
              <span className="font-bold text-xs text-[#3d2617] block border-b border-[#eed7c4] pb-1.5">
                + Tambah Data Member Baru:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">Nama Lengkap Member *</label>
                  <input
                    type="text"
                    placeholder="Nama Pelanggan / Toko"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">No. WhatsApp / HP</label>
                  <input
                    type="tel"
                    placeholder="081234567890"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">Alamat Lengkap</label>
                  <input
                    type="text"
                    placeholder="Jl. P Antasari No. 10"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#166534] flex items-center space-x-1 mb-1">
                    <Percent className="w-3.5 h-3.5" />
                    <span>Diskon Member (%)</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newDiscount}
                      onChange={(e) => setNewDiscount(Number(e.target.value))}
                      className="w-20 px-3 py-1.5 bg-[#edf5ee] text-[#166534] rounded-xl border border-[#cce2cf] font-black text-center"
                      required
                    />
                    <span className="font-bold text-stone-600">% Diskon</span>
                  </div>

                  <div className="flex items-center space-x-1.5 mt-1.5">
                    {[0, 3, 5, 10, 15].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setNewDiscount(pct)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                          newDiscount === pct
                            ? 'bg-[#166534] text-white border-[#166534]'
                            : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-[#3d2617] block mb-1">Limit Bon / Piutang (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#eed7c4]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  Simpan Member Baru
                </button>
              </div>
            </form>
          )}

          {/* Member Cards List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-stone-500 font-bold px-1">
              <span>Daftar Member Terdaftar ({filteredMembers.length})</span>
              <span>Klik <b>Edit</b> untuk ubah diskon • Klik <b>Pilih</b> untuk kasir</span>
            </div>

            {filteredMembers.map((m) => {
              const isSelected = currentMemberId === m.id;
              const discPct = typeof m.discount_percent === 'number' ? m.discount_percent : 5;
              const isConfirmingDelete = deleteConfirmId === m.id;

              return (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-[#edf5ee] border-[#166534] ring-2 ring-[#166534]/20 shadow-xs'
                      : 'bg-white border-[#e5d0be] hover:border-[#b8957c] shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    
                    {/* Left: Info Member */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-black text-sm text-[#3d2617]">{m.name}</span>
                        <span className="text-[10px] font-mono bg-[#f5ebe0] text-[#96633b] px-2 py-0.5 rounded-md border border-[#ddc3aa] font-bold">
                          {m.id}
                        </span>
                        <span className="text-[11px] font-black text-[#166534] bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          Diskon {discPct}%
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold bg-[#166534] text-white px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <Check className="w-3 h-3 inline" />
                            <span>Dipilih di Kasir</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center text-xs text-[#8a6b53] space-x-4">
                        <span className="flex items-center">
                          <Phone className="w-3.5 h-3.5 mr-1 text-[#8a6b53]" />
                          {m.phone || '-'}
                        </span>
                        {m.address && m.address !== '-' && (
                          <span className="flex items-center truncate max-w-[220px]">
                            <MapPin className="w-3.5 h-3.5 mr-1 text-[#8a6b53]" />
                            {m.address}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Buttons (Edit, Pilih, Hapus) */}
                    <div className="flex items-center space-x-1.5 self-end sm:self-center shrink-0">
                      
                      {/* Tombol Edit & Diskon */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(m);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#fdf8f4] hover:bg-[#faebd7] text-[#96633b] border border-[#ddc3aa] text-xs font-bold flex items-center space-x-1 transition-all shadow-2xs"
                        title="Edit data dan diskon member"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {/* Tombol Hapus */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(m.id);
                        }}
                        className="p-1.5 rounded-xl bg-stone-50 hover:bg-rose-50 text-stone-400 hover:text-rose-700 border border-stone-200 transition-colors"
                        title="Hapus member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Tombol Pilih Kasir */}
                      {onSelectMember && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMember(m.id, m);
                            onClose();
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all ${
                            isSelected
                              ? 'bg-[#166534] text-white shadow-xs'
                              : 'bg-[#96633b] hover:bg-[#83532e] text-white shadow-xs'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Terpilih' : 'Pilih'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Delete Confirmation */}
                  {isConfirmingDelete && (
                    <div className="mt-2.5 pt-2.5 border-t border-rose-200 bg-rose-50/70 p-2.5 rounded-xl flex items-center justify-between gap-2 animate-fadeIn text-xs">
                      <div className="flex items-center space-x-1.5 text-rose-800 font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Hapus member "{m.name}" dari sistem?</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2.5 py-1 rounded-lg border border-stone-300 text-stone-600 hover:bg-white text-xs font-bold"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMember(m.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold"
                        >
                          Ya, Hapus
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#e5d0be] text-stone-500 text-xs space-y-1">
                <Users className="w-8 h-8 mx-auto text-stone-300 mb-2" />
                <div className="font-bold text-stone-700">Tidak ada member yang cocok</div>
                <div className="text-[11px]">Silakan ubah kata kunci pencarian atau klik "+ Member Baru".</div>
              </div>
            )}
          </div>

          {/* Reset selection if any */}
          {currentMemberId && onSelectMember && (
            <button
              onClick={() => {
                onSelectMember('', undefined);
                onClose();
              }}
              className="w-full py-2 bg-[#fbeeed] hover:bg-[#f8dbdb] text-rose-700 rounded-xl text-xs font-bold transition-colors border border-[#f4cfcf] flex items-center justify-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Lepas Member dari Transaksi Kasir Saat Ini</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#e5d0be] bg-white flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
