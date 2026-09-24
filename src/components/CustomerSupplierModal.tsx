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
  MapPin
} from 'lucide-react';
import { db } from '../db';
import type { Customer, Supplier } from '../types';
import { formatRupiah } from '../services/escposService';

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

  // Customer Form State
  const [isAddingCust, setIsAddingCust] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [custCode, setCustCode] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState<number>(1000000);

  // Supplier Form State
  const [isAddingSup, setIsAddingSup] = useState(false);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supSalesContact, setSupSalesContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supTermDays, setSupTermDays] = useState<number>(14);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
    }
  }, [isOpen, initialTab]);

  const loadData = async () => {
    try {
      const allCust = await db.customers.toArray();
      const allSup = await db.suppliers.toArray();
      setCustomers(allCust);
      setSuppliers(allSup);
      onUpdated?.();
    } catch (err) {
      console.error('Error loading customers/suppliers:', err);
    }
  };

  // Reset Customer Form
  const resetCustForm = () => {
    setIsAddingCust(false);
    setEditingCustId(null);
    setCustCode('');
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustCreditLimit(1000000);
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

    if (editingCustId) {
      await db.customers.update(editingCustId, {
        code: custCode.trim() || `PLG-${Date.now().toString().slice(-4)}`,
        name: custName.trim(),
        phone: custPhone.trim(),
        address: custAddress.trim(),
        credit_limit: Number(custCreditLimit)
      });
    } else {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        code: custCode.trim() || `PLG-${String(customers.length + 1).padStart(3, '0')}`,
        name: custName.trim(),
        phone: custPhone.trim(),
        address: custAddress.trim(),
        credit_limit: Number(custCreditLimit),
        current_debt: 0
      };
      await db.customers.add(newCust);
    }

    resetCustForm();
    loadData();
  };

  // Edit Customer Trigger
  const handleEditCustomer = (c: Customer) => {
    setEditingCustId(c.id);
    setCustCode(c.code);
    setCustName(c.name);
    setCustPhone(c.phone || '');
    setCustAddress(c.address || '');
    setCustCreditLimit(c.credit_limit || 0);
    setIsAddingCust(true);
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string) => {
    if (confirm('Hapus data pelanggan ini dari database?')) {
      await db.customers.delete(id);
      loadData();
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
        payment_term_days: Number(supTermDays)
      };
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
    if (confirm('Hapus data supplier ini dari database?')) {
      await db.suppliers.delete(id);
      loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              {activeTab === 'customer' ? <Users className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight tracking-tight text-white">Master Data Pelanggan & Supplier</h3>
              <p className="text-xs text-[#fcefe3] font-medium">Kelola kode unik, kontak, alamat, dan batas kredit rekanan toko</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Search Bar - Coklat Susu Foam Bar */}
        <div className="px-4 py-3 border-b border-[#e4d5c7] bg-[#f5ece3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
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
              <span>Data Pelanggan ({customers.length})</span>
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
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-[#856b59] absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === 'customer' ? 'Cari nama / kode pelanggan...' : 'Cari supplier / distributor...'}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dfcebe] text-xs focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20 bg-white"
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
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-[#f6f0ea] min-h-0">
          
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
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
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Kode</th>
                        <th className="py-3 px-4">Nama Pelanggan</th>
                        <th className="py-3 px-4">Kontak & Alamat</th>
                        <th className="py-3 px-4 text-right">Plafon Piutang</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {customers
                        .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search)))
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-lg bg-[#faebd7] text-[#7c4e2f] font-mono font-black text-xs border border-[#eed7c4]">
                                {c.code}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm">{c.name}</div>
                              {c.notes && <div className="text-[11px] text-[#856b59]">{c.notes}</div>}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-1 text-[#543c2e]">
                                <Phone className="w-3 h-3 text-[#a08573]" />
                                <span>{c.phone || '-'}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-[#856b59] text-[11px] mt-0.5">
                                <MapPin className="w-3 h-3 text-[#a08573]" />
                                <span>{c.address || '-'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#332219] whitespace-nowrap">
                              {formatRupiah(c.credit_limit || 0)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => handleEditCustomer(c)}
                                  className="p-1.5 rounded-lg text-[#856b59] hover:text-[#7c4e2f] hover:bg-[#faebd7] transition-colors"
                                  title="Edit Pelanggan"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomer(c.id)}
                                  className="p-1.5 rounded-lg text-[#a08573] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Hapus Pelanggan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
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
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
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
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => handleEditSupplier(s)}
                                  className="p-1.5 rounded-lg text-[#856b59] hover:text-[#7c4e2f] hover:bg-[#faebd7] transition-colors"
                                  title="Edit Supplier"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSupplier(s.id)}
                                  className="p-1.5 rounded-lg text-[#a08573] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Hapus Supplier"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
        <div className="p-4 border-t border-[#e5d0be] bg-white flex items-center justify-between text-xs text-[#8a6b53] shrink-0">
          <span>Data Pelanggan & Supplier tersimpan aman di database offline KetokoPOS</span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl font-bold transition-all shadow-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
