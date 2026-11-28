import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  Search,
  Plus,
  Trash2,
  Calendar,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Banknote,
  QrCode,
  CreditCard
} from 'lucide-react';
import type { CartItem, Customer, Product, TransactionItem } from '../types';
import { db } from '../db';
import { formatRupiah, formatNominalDots, parseNominalDots } from '../services/escposService';
import {
  filterCustomersForStore,
  getCurrentActiveStoreId,
  clampEmployeeBalance,
  MAX_EMPLOYEE_ALLOWANCE,
  isCustomerCardBlocked,
  getCustomerAfdelingDisplay
} from '../utils/customerAccess';

export interface DirectInvoiceCreatePayload {
  invoice_number: string;
  invoice_date: string;
  customer_id?: string;
  customer_name: string;
  payment_method: 'TEMPO' | 'CASH' | 'TRANSFER' | 'QRIS' | 'DEBIT' | 'SALDO';
  due_date?: string;
  dp_given: number;
  discount_amount: number;
  tax_rate: number;
  tax_enabled: boolean;
  notes?: string;
  items: TransactionItem[];
  used_pos_cart: boolean;
}

interface DirectSalesInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  cartItems: CartItem[];
  memberId?: string;
  customerName?: string;
  taxEnabled?: boolean;
  taxRate?: number;
  onSubmitInvoice: (payload: DirectInvoiceCreatePayload) => Promise<void>;
}

interface DraftInvoiceRow {
  product: Product;
  qty: number;
  unit_price: number;
}

export const DirectSalesInvoiceModal: React.FC<DirectSalesInvoiceModalProps> = ({
  isOpen,
  onClose,
  products,
  cartItems,
  memberId = '',
  customerName: initialCustomerName = '',
  taxEnabled: initialTaxEnabled = false,
  taxRate: initialTaxRate = 11,
  onSubmitInvoice
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'TEMPO' | 'CASH' | 'TRANSFER' | 'QRIS' | 'DEBIT' | 'SALDO'>('TEMPO');
  const [dueDate, setDueDate] = useState('');
  const [dpGiven, setDpGiven] = useState<string>('0');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [taxEnabled, setTaxEnabled] = useState<boolean>(initialTaxEnabled);
  const [taxRate, setTaxRate] = useState<number>(initialTaxRate);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);

  // Draft invoice items
  const [rows, setRows] = useState<DraftInvoiceRow[]>([]);
  const [usedPosCart, setUsedPosCart] = useState(false);

  // Add item search state
  const [prodSearch, setProdSearch] = useState('');
  const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);
  const [addQty, setAddQty] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`INV-${ymd}-${rand}`);
    setInvoiceDate(now.toISOString().split('T')[0]);

    const due = new Date();
    due.setDate(due.getDate() + 14);
    setDueDate(due.toISOString().split('T')[0]);

    setDpGiven('0');
    setDiscountInput('0');
    setTaxEnabled(initialTaxEnabled);
    setTaxRate(initialTaxRate);
    setNotes('');
    setSelectedCustomerId(memberId || '');
    setCustomerQuery(initialCustomerName || '');
    setPaymentMethod('TEMPO');

    // Pre-populate rows from active POS cart if cart has items
    if (cartItems.length > 0) {
      const mapped: DraftInvoiceRow[] = cartItems.map((ci) => {
        const prod = products.find((p) => p.id === ci.product_id) || {
          id: ci.product_id,
          barcode: ci.barcode,
          name: ci.product_name,
          category: 'Umum',
          buy_price: ci.buy_price,
          retail_price: ci.retail_price,
          wholesale_price: ci.wholesale_price,
          min_wholesale_qty: ci.min_wholesale_qty,
          stock: ci.stock,
          unit: ci.unit,
          rack_location: '-',
          min_stock_alert: 5
        };
        return {
          product: prod,
          qty: ci.qty,
          unit_price: ci.price_applied
        };
      });
      setRows(mapped);
      setUsedPosCart(true);
    } else {
      setRows([]);
      setUsedPosCart(false);
    }

    db.customers.toArray().then((all) => {
      const filtered = filterCustomersForStore(all || [], getCurrentActiveStoreId());
      setCustomers(filtered);
      if (memberId && !initialCustomerName) {
        const match = filtered.find((c) => c.id === memberId || c.code === memberId);
        if (match) setCustomerQuery(match.name);
      }
    }).catch(() => {});
  }, [isOpen]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 12);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q)
      )
      .slice(0, 12);
  }, [customers, customerQuery]);

  const activeCustomer = useMemo(() => {
    if (selectedCustomerId) {
      const byId = customers.find((c) => c.id === selectedCustomerId || c.code === selectedCustomerId);
      if (byId) return byId;
    }
    const q = customerQuery.trim().toLowerCase();
    if (!q) return null;
    return customers.find((c) => c.name.toLowerCase() === q || (c.code || '').toLowerCase() === q) || null;
  }, [customers, selectedCustomerId, customerQuery]);

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return [];
    const out: Product[] = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (
        p.name.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      ) {
        out.push(p);
        if (out.length >= 10) break;
      }
    }
    return out;
  }, [products, prodSearch]);

  const handleAddProductRow = (prod: Product, qtyToAdd = 1) => {
    const cleanQty = Math.max(1, qtyToAdd);
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.product.id === prod.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + cleanQty };
        return next;
      }
      return [
        ...prev,
        {
          product: prod,
          qty: cleanQty,
          unit_price: prod.retail_price
        }
      ];
    });
    setProdSearch('');
    setAddQty(1);
    setIsProdDropdownOpen(false);
  };

  const subtotal = useMemo(
    () => rows.reduce((sum, r) => sum + r.qty * r.unit_price, 0),
    [rows]
  );
  const discountAmount = Math.min(subtotal, Math.max(0, parseNominalDots(discountInput)));
  const netBeforeTax = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxEnabled ? Math.round((netBeforeTax * (Number(taxRate) || 0)) / 100) : 0;
  const grandTotal = netBeforeTax + taxAmount;
  const dpNumber = Math.min(grandTotal, Math.max(0, parseNominalDots(dpGiven)));
  const remainingReceivable = Math.max(0, grandTotal - dpNumber);

  const availSaldo = activeCustomer
    ? activeCustomer.type === 'KARYAWAN'
      ? clampEmployeeBalance(activeCustomer.deposit_balance, activeCustomer.monthly_allowance ?? MAX_EMPLOYEE_ALLOWANCE)
      : Number(activeCustomer.deposit_balance) || 0
    : 0;

  const setPresetDueDays = (days: number) => {
    const base = invoiceDate ? new Date(invoiceDate) : new Date();
    base.setDate(base.getDate() + days);
    setDueDate(base.toISOString().split('T')[0]);
  };

  if (!isOpen) return null;

  const handleSaveAndPrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (rows.length === 0) {
      alert('⚠️ Tambahkan minimal 1 barang ke daftar item invoice terlebih dahulu.');
      return;
    }
    const finalCustomerName = (activeCustomer?.name || customerQuery).trim();
    if (paymentMethod === 'TEMPO' && !finalCustomerName) {
      alert('⚠️ Masukkan Nama Pelanggan / Perusahaan untuk Invoice Tagihan (Tempo).');
      return;
    }
    if (paymentMethod === 'SALDO') {
      if (!activeCustomer) {
        alert('⚠️ Pilih Anggota / Karyawan terdaftar untuk memotong Saldo.');
        return;
      }
      if (isCustomerCardBlocked(activeCustomer)) {
        alert('🚫 Kartu anggota ini sedang diblokir karena dilaporkan hilang.');
        return;
      }
      if (availSaldo < grandTotal) {
        alert(`⚠️ Saldo tidak mencukupi (${formatRupiah(availSaldo)} < ${formatRupiah(grandTotal)}).`);
        return;
      }
    }

    const itemsPayload: TransactionItem[] = rows.map((r) => ({
      product_id: r.product.id,
      product_name: r.product.name,
      barcode: r.product.barcode,
      unit: r.product.unit,
      qty: r.qty,
      buy_price: r.product.buy_price,
      price_applied: r.unit_price,
      is_wholesale: r.unit_price < r.product.retail_price,
      subtotal_item: r.qty * r.unit_price
    }));

    setIsSaving(true);
    try {
      await onSubmitInvoice({
        invoice_number: invoiceNumber.trim() || `INV-${Date.now()}`,
        invoice_date: invoiceDate,
        customer_id: activeCustomer?.id || selectedCustomerId || undefined,
        customer_name: finalCustomerName || 'PELANGGAN UMUM',
        payment_method: paymentMethod,
        due_date: paymentMethod === 'TEMPO' ? dueDate : undefined,
        dp_given: paymentMethod === 'TEMPO' ? dpNumber : grandTotal,
        discount_amount: discountAmount,
        tax_rate: taxRate,
        tax_enabled: taxEnabled,
        notes: notes.trim() || undefined,
        items: itemsPayload,
        used_pos_cart: usedPosCart
      });
    } catch (err: any) {
      alert('Gagal membuat invoice: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 border-b border-[#85542f] bg-gradient-to-r from-[#7c4e2f] to-[#96633b] text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-2xl bg-white/15 border border-white/25 text-amber-200">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg leading-tight">Input Invoice Penjualan Langsung</h3>
            <p className="text-xs text-[#fcefe3] font-medium">
              Buat faktur/invoice tagihan (jatuh tempo) maupun invoice lunas siap cetak A4 / Bagi 2 / PDF
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Tutup</span>
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSaveAndPrint} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f6f0ea]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT 8 COLS: Metadata & Daftar Barang Invoice */}
          <div className="lg:col-span-8 space-y-4">
            {/* Metadata Card */}
            <div className="bg-white rounded-2xl border border-[#e4d5c7] p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-[#543c2e] block mb-1">Nomor Invoice:</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-20261127-0001"
                  className="w-full px-3 py-2 rounded-xl border border-[#dfcebe] bg-[#fcf8f4] font-mono font-black text-[#332219] focus:bg-white focus:border-[#7c4e2f]"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-[#543c2e] block mb-1">Tanggal Invoice:</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dfcebe] bg-[#fcf8f4] font-mono font-bold text-[#332219] focus:bg-white focus:border-[#7c4e2f]"
                  required
                />
              </div>

              <div className="relative">
                <label className="font-bold text-[#543c2e] block mb-1">
                  Kepada Pelanggan / Perusahaan {paymentMethod === 'TEMPO' && <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-700 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={customerQuery}
                    onFocus={() => setIsCustDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsCustDropdownOpen(false), 180)}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setSelectedCustomerId('');
                      setIsCustDropdownOpen(true);
                    }}
                    placeholder="Ketik nama pelanggan / PT / CV..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#dfcebe] bg-white font-bold text-[#332219] focus:border-[#7c4e2f]"
                  />
                </div>
                {isCustDropdownOpen && filteredCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e4d5c7] rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto p-1">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerQuery(c.name);
                          setIsCustDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#fcf5ed] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-stone-900">{c.name}</div>
                          <div className="text-[10px] text-stone-500 font-mono">
                            {c.code}
                            {getCustomerAfdelingDisplay(c) ? ` • ${getCustomerAfdelingDisplay(c)?.fullLabel}` : ''}
                          </div>
                        </div>
                        {c.type === 'KARYAWAN' && (
                          <span className="text-[10px] font-mono font-bold text-emerald-700">
                            {formatRupiah(Number(c.deposit_balance) || 0)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product Search & Invoice Items Table */}
            <div className="bg-white rounded-2xl border border-[#e4d5c7] p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#332219] uppercase tracking-wider">
                  Rincian Barang / Jasa pada Invoice ({rows.length} Baris)
                </span>
                {usedPosCart && (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    ✓ Otomatis dimuat dari Keranjang Kasir
                  </span>
                )}
              </div>

              {/* Search Product Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center relative">
                <div className="sm:col-span-8 relative">
                  <Search className="w-4 h-4 text-[#8a6b53] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={prodSearch}
                    onFocus={() => setIsProdDropdownOpen(true)}
                    onChange={(e) => {
                      setProdSearch(e.target.value);
                      setIsProdDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredProducts.length > 0) {
                        e.preventDefault();
                        handleAddProductRow(filteredProducts[0], addQty);
                      }
                    }}
                    placeholder="Cari & tambah produk (ketik nama barang / kode / scan barcode lalu Enter)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dfcebe] bg-[#fcf8f4] focus:bg-white text-xs font-medium"
                  />
                  {isProdDropdownOpen && filteredProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e4d5c7] rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto p-1 space-y-0.5">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddProductRow(p, addQty)}
                          className="w-full text-left p-2 rounded-lg hover:bg-[#fcf5ed] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-stone-900">{p.name}</div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              {p.barcode || p.id} • Stok: {p.stock} {p.unit}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-[#7c4e2f]">{formatRupiah(p.retail_price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl border border-[#dfcebe] bg-white font-mono font-bold text-xs text-center"
                    placeholder="Qty"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    disabled={filteredProducts.length === 0}
                    onClick={() => filteredProducts[0] && handleAddProductRow(filteredProducts[0], addQty)}
                    className="w-full py-2 px-3 rounded-xl bg-[#7c4e2f] hover:bg-[#5c3c26] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-[#ebdccf] rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[#f5ece3] text-[#543c2e] font-black text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Nama Barang</th>
                      <th className="py-2.5 px-2 text-center w-24">Qty</th>
                      <th className="py-2.5 px-2 text-right w-36">Harga Satuan (Rp)</th>
                      <th className="py-2.5 px-3 text-right w-36">Jumlah</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e4d7]">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-stone-400">
                          Belum ada item. Cari produk pada kolom di atas untuk dimasukkan ke invoice.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, idx) => (
                        <tr key={r.product.id} className="hover:bg-stone-50/70">
                          <td className="py-2 px-3">
                            <div className="font-bold text-stone-900">{r.product.name}</div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              {r.product.barcode || r.product.id} • Satuan: {r.product.unit}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={r.qty}
                              onChange={(e) => {
                                const q = Math.max(1, Number(e.target.value) || 1);
                                setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: q } : it)));
                              }}
                              className="w-20 px-2 py-1 text-center font-mono font-bold border border-[#dfcebe] rounded-lg bg-white"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNominalDots(r.unit_price)}
                              onChange={(e) => {
                                const up = Math.max(0, parseNominalDots(e.target.value));
                                setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, unit_price: up } : it)));
                              }}
                              className="w-32 px-2 py-1 text-right font-mono font-bold border border-[#dfcebe] rounded-lg bg-white"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-[#332219]">
                            {formatRupiah(r.qty * r.unit_price)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Catatan / No PO */}
              <div>
                <label className="text-[11px] font-bold text-[#543c2e] block mb-1">
                  Catatan Invoice / Nomor PO / Alamat Pengiriman (Opsional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: PO No. 042/MSL/XI/2026 • Pembayaran transfer ke Rek Koperasi..."
                  className="w-full px-3 py-2 rounded-xl border border-[#dfcebe] bg-[#fcf8f4] focus:bg-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLS: Pilihan Status Invoice & Total */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-[#e4d5c7] p-4 shadow-2xs space-y-3.5 text-xs">
              <div>
                <label className="font-extrabold text-[#543c2e] uppercase tracking-wider text-[11px] block mb-2">
                  Pilihan Jenis / Pembayaran Invoice
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'TEMPO', label: 'Tagihan / Tempo', sub: 'Piutang Invoice', icon: Calendar },
                    { id: 'CASH', label: 'Lunas Tunai', sub: 'Bayar Cash', icon: Banknote },
                    { id: 'TRANSFER', label: 'Lunas Transfer', sub: 'Rekening Bank', icon: CreditCard },
                    { id: 'QRIS', label: 'Lunas QRIS', sub: 'Scan QRIS', icon: QrCode },
                    { id: 'SALDO', label: 'Potong Saldo', sub: 'Kuota Member', icon: Wallet }
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = paymentMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 ${
                          active
                            ? 'bg-[#7c4e2f] text-white border-[#5c3c26] shadow-xs'
                            : 'bg-[#fcf8f4] text-[#332219] border-[#ebdccf] hover:bg-[#f5ece3]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-amber-200' : 'text-[#7c4e2f]'}`} />
                        <div className="min-w-0">
                          <div className="font-extrabold text-[11px] leading-tight">{opt.label}</div>
                          <div className={`text-[9.5px] ${active ? 'text-white/80' : 'text-stone-500'}`}>{opt.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pengaturan Jatuh Tempo & DP bila TEMPO */}
              {paymentMethod === 'TEMPO' && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-amber-950 block mb-1">Jatuh Tempo Tagihan:</label>
                    <div className="grid grid-cols-4 gap-1 mb-1.5">
                      {[7, 14, 30, 45].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPresetDueDays(d)}
                          className="py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900 cursor-pointer"
                        >
                          +{d} Hr
                        </button>
                      ))}
                    </div>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-mono font-bold text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-amber-950 block mb-1">Uang Muka / DP Diterima (Rp):</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNominalDots(dpGiven)}
                      onChange={(e) => setDpGiven(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-mono font-bold text-xs text-right"
                    />
                    <div className="flex justify-between text-[11px] font-extrabold text-rose-700 pt-1">
                      <span>Sisa Tagihan Invoice:</span>
                      <span className="font-mono">{formatRupiah(remainingReceivable)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Info Saldo jika SALDO */}
              {paymentMethod === 'SALDO' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  {activeCustomer ? (
                    <>
                      <div className="font-bold text-emerald-950">{activeCustomer.name}</div>
                      <div className="flex justify-between text-[11px]">
                        <span>Saldo Tersedia:</span>
                        <span className="font-mono font-black text-emerald-800">{formatRupiah(availSaldo)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Pilih anggota/karyawan pada kolom Pelanggan di kiri atas.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Diskon & PPN */}
              <div className="space-y-2 pt-2 border-t border-[#f0e4d7]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-600 font-semibold">Potongan Diskon (Rp):</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNominalDots(discountInput)}
                    onChange={(e) => setDiscountInput(e.target.value.replace(/\D/g, ''))}
                    className="w-32 px-2.5 py-1 rounded-lg border border-[#dfcebe] font-mono font-bold text-right bg-[#fcf8f4]"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 font-semibold text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxEnabled}
                      onChange={(e) => setTaxEnabled(e.target.checked)}
                      className="rounded accent-[#166534]"
                    />
                    <span>PPN (%)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!taxEnabled}
                    value={taxRate}
                    onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 px-2 py-1 rounded-lg border border-[#dfcebe] font-mono font-bold text-right disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Ringkasan Total */}
              <div className="p-3.5 rounded-2xl bg-[#7c4e2f] text-white space-y-1">
                <div className="flex justify-between text-[11px] text-white/85">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatRupiah(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[11px] text-amber-200">
                    <span>Diskon:</span>
                    <span className="font-mono">-{formatRupiah(discountAmount)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-[11px] text-white/85">
                    <span>PPN ({taxRate}%):</span>
                    <span className="font-mono">{formatRupiah(taxAmount)}</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-1.5 flex items-baseline justify-between">
                  <span className="font-extrabold uppercase text-xs text-amber-200">Total Invoice</span>
                  <span className="font-mono font-black text-2xl">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving || rows.length === 0}
                className="w-full py-3.5 px-4 rounded-xl bg-[#166534] hover:bg-[#14532d] disabled:opacity-40 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-amber-300" />
                <span>{isSaving ? 'Menyimpan Invoice...' : 'SIMPAN & BUKA CETAK INVOICE'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
