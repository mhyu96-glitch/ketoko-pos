import React, { useState } from 'react';
import { X, Users, UserPlus, Check, Phone } from 'lucide-react';
import { db } from '../db';
import type { Customer } from '../types';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (memberId: string) => void;
  currentMemberId?: string;
}

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSelectMember,
  currentMemberId
}) => {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [members, setMembers] = useState<Customer[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      db.customers.toArray().then((custs) => {
        if (custs.length > 0) {
          setMembers(custs);
        } else {
          // Defaults if empty
          setMembers([
            { id: 'MBR-001', code: 'CUST-001', name: 'Budi Santoso', phone: '081234567890', address: 'Jl. Ahmad Yani No. 12', credit_limit: 5000000, current_debt: 0, created_at: new Date().toISOString() },
            { id: 'MBR-002', code: 'CUST-002', name: 'Siti Rahmawati', phone: '085298765432', address: 'Jl. Merdeka No. 45', credit_limit: 3000000, current_debt: 0, created_at: new Date().toISOString() },
            { id: 'MBR-003', code: 'CUST-003', name: 'Toko Kelontong Berkah', phone: '081345678901', address: 'Jl. Gajah Mada No. 8', credit_limit: 10000000, current_debt: 0, created_at: new Date().toISOString() }
          ]);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newId = `MBR-00${members.length + 1}`;
    const newMember: Customer = {
      id: newId,
      code: `CUST-00${members.length + 1}`,
      name: newName.trim(),
      phone: newPhone.trim() || '-',
      address: 'Lokal',
      credit_limit: 5000000,
      current_debt: 0,
      created_at: new Date().toISOString()
    };

    await db.customers.put(newMember);
    setMembers([...members, newMember]);
    setNewName('');
    setNewPhone('');
    setShowAddForm(false);
    onSelectMember(newId);
    onClose();
  };

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Data Member & Pelanggan</h3>
              <p className="text-xs text-[#fcefe3]">Diskon otomatis 5% untuk transaksi pelanggan terdaftar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 bg-[#fcf9f5]">
          {/* Search & Add New Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID, Nama, atau No. HP..."
              className="flex-1 px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b]"
            />
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Batal' : '+ Baru'}</span>
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <form onSubmit={handleAddMember} className="p-3 bg-white rounded-2xl border border-[#e5d0be] space-y-2.5 shadow-xs">
              <span className="font-bold text-xs text-[#3d2617] block">Daftar Member Baru (Langsung Aktif):</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nama Lengkap *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs"
                  required
                />
                <input
                  type="tel"
                  placeholder="No. WhatsApp / HP"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold transition-colors"
              >
                Simpan & Gunakan Member
              </button>
            </form>
          )}

          {/* Member Cards List */}
          <div className="space-y-2">
            {filteredMembers.map((m) => {
              const isSelected = currentMemberId === m.id;

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    onSelectMember(m.id);
                    onClose();
                  }}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#faebd7] border-[#eed7c4] shadow-xs'
                      : 'bg-white border-[#e5d0be] hover:border-[#b8957c]'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-[#3d2617]">{m.name}</span>
                      <span className="text-[10px] font-mono bg-[#f5ebe0] text-[#96633b] px-1.5 py-0.2 rounded border border-[#ddc3aa]">
                        {m.id}
                      </span>
                    </div>
                    <div className="flex items-center text-[11px] text-[#8a6b53] mt-0.5 space-x-2">
                      <span className="flex items-center">
                        <Phone className="w-3 h-3 mr-1 text-[#8a6b53]" />
                        {m.phone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-[#166534] bg-[#edf5ee] px-2 py-0.5 rounded-full border border-[#cce2cf]">
                      Diskon 5%
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#96633b] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {currentMemberId && (
            <button
              onClick={() => {
                onSelectMember('');
                onClose();
              }}
              className="w-full py-2 bg-[#fbeeed] hover:bg-[#f8dbdb] text-rose-700 rounded-xl text-xs font-bold transition-colors border border-[#f4cfcf]"
            >
              Lepas Member dari Transaksi Ini
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#e5d0be] bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
