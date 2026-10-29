import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Plus, 
  Search, 
  RotateCcw, 
  AlertTriangle, 
  Receipt, 
  Package,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { db } from '../db';
import type { Transaction, TransactionItem, Product } from '../types';
import { syncService } from '../services/syncService';
import { formatRupiah } from '../services/escposService';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  products?: Product[];
  onSaved?: (updatedTrx: Transaction) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  products: propProducts,
  onSaved
}) => {
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER' | 'TEMPO'>('CASH');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Catalog products for search
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load products catalog if not provided
  useEffect(() => {
    if (propProducts && propProducts.length > 0) {
      setCatalogProducts(propProducts);
    } else {
      db.products.toArray().then(setCatalogProducts).catch(() => {});
    }
  }, [propProducts, isOpen]);

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      setItems(
        (transaction.items || []).map((it) => ({
          ...it,
          qty: Number(it.qty) || 1,
          price_applied: Number(it.price_applied) || 0,
          subtotal_item: Number(it.subtotal_item) || (Number(it.qty) || 1) * (Number(it.price_applied) || 0)
        }))
      );
      setCustomerName(transaction.customer_name || '');
      setPaymentMethod(transaction.payment_method || 'CASH');
      setCashGiven(Number(transaction.cash_given) || Number(transaction.grand_total) || 0);
      setDiscountAmount(Number(transaction.discount_amount) || 0);
      setTaxAmount(Number(transaction.tax_amount) || 0);
      setNotes(transaction.notes || '');
      setDueDate(transaction.due_date || new Date().toISOString().split('T')[0]);
      setError(null);
      setProductSearch('');
      setIsSearchingProduct(false);
    }
  }, [transaction, isOpen]);

  // Re-calculate subtotal, grand total, and change
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.subtotal_item) || 0), 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - Number(discountAmount || 0) + Number(taxAmount || 0));
  }, [subtotal, discountAmount, taxAmount]);

  const changeReturned = useMemo(() => {
    if (paymentMethod !== 'CASH') return 0;
    return Math.max(0, Number(cashGiven || 0) - grandTotal);
  }, [paymentMethod, cashGiven, grandTotal]);

  // Filter catalog products for search
  const searchResults = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return catalogProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [catalogProducts, productSearch]);

  // Stock differential impact analysis
  const stockDeltas = useMemo(() => {
    if (!transaction) return [];
    const origMap = new Map<string, number>();
    for (const it of transaction.items || []) {
      origMap.set(String(it.product_id), (origMap.get(String(it.product_id)) || 0) + (Number(it.qty) || 0));
    }

    const currentMap = new Map<string, { name: string; qty: number }>();
    for (const it of items) {
      const pId = String(it.product_id);
      const prev = currentMap.get(pId);
      currentMap.set(pId, {
        name: it.product_name,
        qty: (prev?.qty || 0) + (Number(it.qty) || 0)
      });
    }

    const allIds = new Set<string>([...origMap.keys(), ...currentMap.keys()]);
    const deltas: Array<{
      productId: string;
      productName: string;
      oldQty: number;
      newQty: number;
      delta: number; // oldQty - newQty (>0 returns to stock, <0 reduces stock)
    }> = [];

    for (const pId of allIds) {
      const oldQty = origMap.get(pId) || 0;
      const cur = currentMap.get(pId);
      const newQty = cur?.qty || 0;
      const delta = oldQty - newQty;
      const productName = cur?.name || transaction.items?.find((i) => String(i.product_id) === pId)?.product_name || `Produk #${pId}`;

      if (delta !== 0) {
        deltas.push({
          productId: pId,
          productName,
          oldQty,
          newQty,
          delta
        });
      }
    }

    return deltas;
  }, [transaction, items]);

  if (!isOpen || !transaction) return null;

  // Item modification handlers
  const handleUpdateItemQty = (index: number, newQty: number) => {
    const qty = Math.max(1, Number(newQty) || 1);
    setItems((prev) => {
      const copy = [...prev];
      const it = copy[index];
      copy[index] = {
        ...it,
        qty,
        subtotal_item: qty * (Number(it.price_applied) || 0)
      };
      return copy;
    });
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    const price = Math.max(0, Number(newPrice) || 0);
    setItems((prev) => {
      const copy = [...prev];
      const it = copy[index];
      copy[index] = {
        ...it,
        price_applied: price,
        subtotal_item: (Number(it.qty) || 1) * price
      };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddProduct = (prod: Product) => {
    const existingIndex = items.findIndex((it) => String(it.product_id) === String(prod.id));
    if (existingIndex >= 0) {
      handleUpdateItemQty(existingIndex, items[existingIndex].qty + 1);
    } else {
      const newItem: TransactionItem = {
        product_id: String(prod.id),
        product_name: prod.name,
        barcode: prod.barcode,
        unit: prod.unit || 'Pcs',
        qty: 1,
        buy_price: prod.buy_price || 0,
        price_applied: prod.retail_price || 0,
        is_wholesale: false,
        subtotal_item: prod.retail_price || 0
      };
      setItems((prev) => [...prev, newItem]);
    }
    setProductSearch('');
    setIsSearchingProduct(false);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      setError('Nota transaksi harus memiliki minimal 1 barang belanjaan.');
      return;
    }

    for (const it of items) {
      if (Number(it.qty) <= 0) {
        setError(`Jumlah qty untuk barang "${it.product_name}" harus lebih dari 0.`);
        return;
      }
      if (Number(it.price_applied) < 0) {
        setError(`Harga untuk barang "${it.product_name}" tidak valid.`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedTrx: Transaction = {
        ...transaction,
        customer_name: customerName.trim() || undefined,
        payment_method: paymentMethod,
        items,
        subtotal,
        discount_amount: Number(discountAmount) || 0,
        tax_amount: Number(taxAmount) || 0,
        grand_total: grandTotal,
        cash_given: paymentMethod === 'CASH' ? Number(cashGiven) || grandTotal : grandTotal,
        change_returned: changeReturned,
        due_date: paymentMethod === 'TEMPO' ? dueDate : undefined,
        notes: notes.trim() || undefined
      };

      await syncService.updateTransaction(updatedTrx, transaction);
      onSaved?.(updatedTrx);
      onClose();
    } catch (err: any) {
      console.error('Gagal memperbarui nota transaksi:', err);
      setError(err?.message || 'Gagal menyimpan perubahan nota.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-[#e5d5c5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-linear-to-r from-[#96633b] to-[#7a4e2b] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
              <Receipt className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold">Edit Nota Transaksi</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-400 text-stone-900 shadow-xs">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-amber-100/90">
                Nota: <span className="font-mono font-bold">{transaction.receipt_number}</span> &bull; Kasir: {transaction.cashier_name || 'Kasir'} &bull; {new Date(transaction.created_at).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 divide-y divide-[#f2e5d8]">
          {/* Section 1: Customer, Payment & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pb-2">
            <div>
              <label className="block text-xs font-bold text-[#5c3c26] mb-1">
                Nama Pelanggan
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Pelanggan Umum"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#ddc3aa] bg-[#fcf9f5] focus:outline-hidden focus:ring-2 focus:ring-[#96633b] text-[#3d271d]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5c3c26] mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#ddc3aa] bg-[#fcf9f5] focus:outline-hidden focus:ring-2 focus:ring-[#96633b] text-[#3d271d] font-semibold"
              >
                <option value="CASH">Tunai (CASH)</option>
                <option value="QRIS">QRIS</option>
                <option value="TRANSFER">Transfer Bank</option>
                <option value="DEBIT">Kartu Debit</option>
                <option value="TEMPO">Bon / Tempo (Piutang)</option>
              </select>
            </div>

            {paymentMethod === 'TEMPO' ? (
              <div>
                <label className="block text-xs font-bold text-[#5c3c26] mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-[#96633b]" />
                  <span>Jatuh Tempo Piutang</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#ddc3aa] bg-[#fcf9f5] focus:outline-hidden focus:ring-2 focus:ring-[#96633b] text-[#3d271d]"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#5c3c26] mb-1">
                  Catatan Transaksi
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan (opsional)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#ddc3aa] bg-[#fcf9f5] focus:outline-hidden focus:ring-2 focus:ring-[#96633b] text-[#3d271d]"
                />
              </div>
            )}
          </div>

          {/* Section 2: Items Table */}
          <div className="pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-[#96633b]" />
                <h4 className="text-xs font-bold text-[#5c3c26] uppercase tracking-wider">
                  Daftar Barang Belanjaan ({items.length} item)
                </h4>
              </div>

              {/* Add item button / Search toggler */}
              <button
                type="button"
                onClick={() => setIsSearchingProduct(!isSearchingProduct)}
                className="px-3 py-1.5 rounded-xl bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] text-xs font-bold flex items-center space-x-1.5 border border-[#ddc3aa] transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-[#96633b]" />
                <span>{isSearchingProduct ? 'Tutup Pencarian' : '+ Tambah Barang ke Nota'}</span>
              </button>
            </div>

            {/* Product search box */}
            {isSearchingProduct && (
              <div className="p-3 bg-[#fbf7f2] border border-[#ddc3aa] rounded-xl space-y-2 animate-fadeIn">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ketik nama produk atau barcode untuk menambahkan..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#ddc3aa] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#96633b]"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="divide-y divide-[#f0e4d7] bg-white rounded-xl border border-[#e8d7c7] overflow-hidden max-h-48 overflow-y-auto shadow-xs">
                    {searchResults.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => handleAddProduct(prod)}
                        className="p-2.5 hover:bg-[#fcf6f0] cursor-pointer flex justify-between items-center text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-[#3d271d]">{prod.name}</div>
                          <div className="text-[10px] text-stone-500 font-mono">
                            {prod.barcode || 'Tanpa Barcode'} &bull; Stok Toko: {prod.stock || 0} {prod.unit || 'Pcs'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-[#96633b]">{formatRupiah(prod.retail_price || 0)}</div>
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            + Tambah
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {productSearch.trim().length > 0 && searchResults.length === 0 && (
                  <div className="p-3 text-center text-xs text-stone-500 italic bg-white rounded-xl border border-[#e8d7c7]">
                    Produk tidak ditemukan di katalog toko.
                  </div>
                )}
              </div>
            )}

            {/* Items Table */}
            <div className="overflow-x-auto rounded-xl border border-[#e8d7c7]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f5ebe0] text-[#5c3c26] border-b border-[#e8d7c7] font-bold">
                    <th className="py-2.5 px-3">Nama Produk</th>
                    <th className="py-2.5 px-3 text-right w-28">Harga (Rp)</th>
                    <th className="py-2.5 px-3 text-center w-28">Qty</th>
                    <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                    <th className="py-2.5 px-2 text-center w-10">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2e5d8] bg-white">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[#fcf9f5] transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#3d271d]">{it.product_name}</div>
                        <div className="text-[10px] text-stone-500 font-mono">
                          {it.barcode || 'Barang Toko'} &bull; Satuan: {it.unit || 'Pcs'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={it.price_applied}
                          onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-right text-xs rounded-lg border border-[#ddc3aa] bg-[#fcf9f5] focus:outline-hidden focus:ring-1 focus:ring-[#96633b] font-mono font-semibold"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(idx, it.qty - 1)}
                            disabled={it.qty <= 1}
                            className="w-6 h-6 rounded-md bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] font-bold text-xs flex items-center justify-center disabled:opacity-40 transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={it.qty}
                            onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                            className="w-12 px-1 py-1 text-center text-xs rounded-lg border border-[#ddc3aa] bg-[#fcf9f5] focus:outline-hidden focus:ring-1 focus:ring-[#96633b] font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(idx, it.qty + 1)}
                            className="w-6 h-6 rounded-md bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] font-bold text-xs flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#96633b] font-mono">
                        {formatRupiah(it.subtotal_item || 0)}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Hapus barang dari nota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-stone-500 italic">
                        Tidak ada barang pada nota ini. Silakan tambah barang di atas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Stock Differential Preview */}
          {stockDeltas.length > 0 && (
            <div className="pt-4 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-[#5c3c26]">
                <RotateCcw className="w-3.5 h-3.5 text-[#96633b]" />
                <span>Penyesuaian Otomatis Stok Fisik Barang (Diferensial):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {stockDeltas.map((sd, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      sd.delta > 0
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/70 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div>
                      <div className="font-bold truncate max-w-[200px]">{sd.productName}</div>
                      <div className="text-[10px] opacity-75">
                        Nota Lama: {sd.oldQty} &rarr; Nota Baru: {sd.newQty}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          sd.delta > 0
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {sd.delta > 0 ? `+${sd.delta} Kembali ke Stok` : `${sd.delta} Dipotong Stok`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Totals & Payments */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Quick Nominal Cash Given */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2.5 p-3.5 bg-[#fcf9f5] rounded-xl border border-[#e8d7c7]">
                <label className="block text-xs font-bold text-[#5c3c26]">
                  Uang Diterima / Bayar (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cashGiven}
                  onChange={(e) => setCashGiven(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#ddc3aa] bg-white font-mono font-bold text-[#3d271d] focus:outline-hidden focus:ring-2 focus:ring-[#96633b]"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashGiven(grandTotal)}
                    className="px-2 py-1 text-[11px] rounded-lg bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] font-semibold transition-colors"
                  >
                    Uang Pas
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashGiven(Math.ceil(grandTotal / 50000) * 50000)}
                    className="px-2 py-1 text-[11px] rounded-lg bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] font-semibold transition-colors"
                  >
                    Bulatkan 50k
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashGiven(Math.ceil(grandTotal / 100000) * 100000)}
                    className="px-2 py-1 text-[11px] rounded-lg bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] font-semibold transition-colors"
                  >
                    Bulatkan 100k
                  </button>
                </div>
                {changeReturned > 0 && (
                  <div className="pt-1 text-xs text-emerald-700 font-bold flex justify-between">
                    <span>Kembalian Kasir:</span>
                    <span className="font-mono">{formatRupiah(changeReturned)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Right: Subtotal, Discount, Tax & Grand Total */}
            <div className="space-y-2 p-3.5 bg-[#fcf9f5] rounded-xl border border-[#e8d7c7] text-xs">
              <div className="flex justify-between items-center text-stone-600">
                <span>Subtotal Barang:</span>
                <span className="font-mono font-bold text-stone-800">{formatRupiah(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#166534] font-semibold">Potongan Diskon (Rp):</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-28 px-2 py-1 text-right text-xs rounded-lg border border-[#ddc3aa] bg-white font-mono font-semibold text-[#166534] focus:outline-hidden focus:ring-1 focus:ring-[#96633b]"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-stone-600">Pajak PPN (Rp):</span>
                <input
                  type="number"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                  className="w-28 px-2 py-1 text-right text-xs rounded-lg border border-[#ddc3aa] bg-white font-mono font-semibold text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-[#96633b]"
                />
              </div>

              <div className="pt-2 border-t border-[#ddc3aa] flex justify-between items-center text-sm font-bold text-[#96633b]">
                <span>Grand Total Akhir:</span>
                <span className="font-mono text-base">{formatRupiah(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#fcf9f5] border-t border-[#e8d7c7] flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="text-xs text-stone-500 flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Perubahan nota akan otomatis menyinkronkan stok fisik toko dan cloud.</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || items.length === 0}
              className="px-5 py-2 rounded-xl bg-[#96633b] hover:bg-[#83532e] text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan Perubahan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Nota</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
