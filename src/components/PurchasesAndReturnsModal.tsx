import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Truck, 
  FileText, 
  RotateCcw, 
  Receipt, 
  Plus,
  Search
} from 'lucide-react';
import { db } from '../db';
import type { Purchase, PurchaseReturn, SalesReturn, Supplier, Product } from '../types';
import { formatRupiah } from '../services/escposService';
import { CustomSelect } from './CustomSelect';
import { lanService } from '../services/lanService';
import { syncService } from '../services/syncService';

interface PurchasesAndReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'history' | 'purchase_return' | 'sales_return';
  onUpdated?: () => void;
}

export const PurchasesAndReturnsModal: React.FC<PurchasesAndReturnsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'history',
  onUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'purchase_return' | 'sales_return'>(initialTab);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // State: Add New Purchase
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [poInvoice, setPoInvoice] = useState('');
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poPaymentType, setPoPaymentType] = useState<'CASH' | 'TEMPO'>('CASH');
  const [poDueDate, setPoDueDate] = useState('');
  const [poItems, setPoItems] = useState<{ product: Product; qty: number; buy_price: number; subtotal: number }[]>([]);
  const [poSelectedProdId, setPoSelectedProdId] = useState('');
  const [poProductSearch, setPoProductSearch] = useState('');
  const [isPoSearching, setIsPoSearching] = useState(false);
  const [poQty, setPoQty] = useState<number>(1);

  // State: Add Purchase Return
  const [isAddingPurchaseReturn, setIsAddingPurchaseReturn] = useState(false);
  const [retSupId, setRetSupId] = useState('');
  const [retProdId, setRetProdId] = useState('');
  const [retPurchaseProductSearch, setRetPurchaseProductSearch] = useState('');
  const [isRetPurchaseSearching, setIsRetPurchaseSearching] = useState(false);
  const [retQty, setRetQty] = useState<number>(1);
  const [retReason, setRetReason] = useState('');
  const [retAction, setRetAction] = useState<'POTONG_HUTANG' | 'KEMBALI_TUNAI'>('POTONG_HUTANG');

  // State: Add Sales Return
  const [isAddingSalesReturn, setIsAddingSalesReturn] = useState(false);
  const [retReceiptNo, setRetReceiptNo] = useState('');
  const [retCustName, setRetCustName] = useState('');
  const [retSalesProdId, setRetSalesProdId] = useState('');
  const [retSalesProductSearch, setRetSalesProductSearch] = useState('');
  const [isRetSalesSearching, setIsRetSalesSearching] = useState(false);
  const [retSalesQty, setRetSalesQty] = useState<number>(1);
  const [retSalesReason, setRetSalesReason] = useState('');

  // Fast autocomplete search results for PO (top 8)
  const poSearchResults = useMemo(() => {
    const q = poProductSearch.toLowerCase().trim();
    if (!q) return [];
    const res: Product[] = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.id.toLowerCase().includes(q)) {
        res.push(p);
        if (res.length >= 8) break;
      }
    }
    return res;
  }, [products, poProductSearch]);

  // Fast autocomplete search results for Purchase Return to Supplier (top 8)
  const retPurchaseSearchResults = useMemo(() => {
    const q = retPurchaseProductSearch.toLowerCase().trim();
    if (!q) return [];
    const res: Product[] = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.id.toLowerCase().includes(q)) {
        res.push(p);
        if (res.length >= 8) break;
      }
    }
    return res;
  }, [products, retPurchaseProductSearch]);

  // Fast autocomplete search results for Sales Return (top 8)
  const retSalesSearchResults = useMemo(() => {
    const q = retSalesProductSearch.toLowerCase().trim();
    if (!q) return [];
    const res: Product[] = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.id.toLowerCase().includes(q)) {
        res.push(p);
        if (res.length >= 8) break;
      }
    }
    return res;
  }, [products, retSalesProductSearch]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
    }
  }, [isOpen, initialTab]);

  const loadData = async () => {
    // 1. Tarik dari LAN jika mode klien
    if (lanService.isClientMode()) {
      try {
        const centralPurchases = await lanService.fetchCentralPurchases();
        if (centralPurchases && centralPurchases.length > 0) {
          await db.purchases.bulkPut(centralPurchases);
        }
      } catch (err) {
        console.warn('[Purchases] Gagal tarik pembelian dari LAN:', err);
      }
    }

    // 2. Tarik dari Supabase jika online
    if (navigator.onLine) {
      try {
        await syncService.pullPurchasesFromSupabase();
      } catch (err) {
        console.warn('[Purchases] Gagal tarik pembelian dari Supabase:', err);
      }
    }

    const allPurchases = await db.purchases.toArray();
    const allPRet = await db.purchaseReturns.toArray();
    const allSRet = await db.salesReturns.toArray();
    const allSuppliers = await db.suppliers.toArray();
    const allProducts = await db.products.toArray();

    setPurchases(allPurchases);
    setPurchaseReturns(allPRet);
    setSalesReturns(allSRet);
    setSuppliers(allSuppliers);
    setProducts(allProducts);
  };

  // Add Item to Draft Purchase
  const handleAddItemToPo = () => {
    if (!poSelectedProdId || poQty <= 0) return;
    const prod = products.find((p) => p.id === poSelectedProdId);
    if (!prod) return;

    const existingIndex = poItems.findIndex((it) => it.product.id === prod.id);
    if (existingIndex >= 0) {
      const updated = [...poItems];
      updated[existingIndex].qty += poQty;
      updated[existingIndex].subtotal = updated[existingIndex].qty * updated[existingIndex].buy_price;
      setPoItems(updated);
    } else {
      setPoItems([
        ...poItems,
        {
          product: prod,
          qty: poQty,
          buy_price: prod.buy_price,
          subtotal: poQty * prod.buy_price
        }
      ]);
    }

    setPoSelectedProdId('');
    setPoQty(1);
  };

  // Handle Save Purchase (Tambah Stok Otomatis & Sinkron)
  const handleSavePurchase = async () => {
    if (!poInvoice.trim() || !poSupplierId || poItems.length === 0) return;
    const sup = suppliers.find((s) => s.id === poSupplierId);
    if (!sup) return;

    const totalBill = poItems.reduce((acc, it) => acc + it.subtotal, 0);
    const dueDateValue = poPaymentType === 'TEMPO' 
      ? (poDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]) 
      : undefined;

    const newPurchase: Purchase = {
      id: `pur-${Date.now()}`,
      invoice_number: poInvoice.trim(),
      supplier_id: sup.id,
      supplier_name: sup.name,
      date: new Date().toISOString().split('T')[0],
      items: poItems.map((it) => ({
        product_id: it.product.id,
        product_name: it.product.name,
        buy_price: it.buy_price,
        qty: it.qty,
        subtotal: it.subtotal
      })),
      total: totalBill,
      payment_type: poPaymentType,
      due_date: dueDateValue,
      status: 'RECEIVED'
    };

    // 1. Simpan Pembelian ke Dexie Lokal
    await db.purchases.put(newPurchase);

    // 2. Tambah Stok Fisik untuk Setiap Barang
    for (const it of poItems) {
      const p = await db.products.get(it.product.id);
      if (p) {
        await db.products.update(p.id, {
          stock: p.stock + it.qty
        });
      }
    }

    // 3. Jika TEMPO (Invoice), catat otomatis ke Hutang Usaha (Debts)
    if (poPaymentType === 'TEMPO') {
      await db.debts.put({
        id: `debt-${Date.now()}`,
        supplier_id: sup.id,
        supplier_code: sup.code,
        supplier_name: sup.name,
        invoice_number: poInvoice.trim(),
        total_amount: totalBill,
        paid_amount: 0,
        remaining_amount: totalBill,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: dueDateValue || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        status: 'UNPAID',
        notes: `Faktur Pembelian ${poInvoice}`
      });
    }

    // 4. Sinkronisasi ke LAN Server (Multi-Kasir Terpusat)
    if (lanService.isClientMode()) {
      try {
        await lanService.submitPurchase(newPurchase);
      } catch (err) {
        console.warn('[Purchases] Gagal kirim pembelian ke LAN server:', err);
      }
    }

    // 5. Sinkronisasi ke Cloud Supabase
    if (navigator.onLine) {
      try {
        await syncService.pushPurchaseToSupabase(newPurchase);
        if (poPaymentType === 'TEMPO') {
          await syncService.syncDebtsAndReceivables();
        }
      } catch (err) {
        console.warn('[Purchases] Gagal kirim pembelian ke Supabase:', err);
      }
    }

    setIsAddingPurchase(false);
    setPoInvoice('');
    setPoItems([]);
    await loadData();
    onUpdated?.();
  };

  // Handle Save Purchase Return (ke Supplier)
  const handleSavePurchaseReturn = async () => {
    if (!retSupId || !retProdId || retQty <= 0) return;
    const sup = suppliers.find((s) => s.id === retSupId);
    const prod = products.find((p) => p.id === retProdId);
    if (!sup || !prod) return;

    const returnNumber = `RET-BELI-${Date.now().toString().slice(-6)}`;
    const totalVal = retQty * prod.buy_price;

    const newRet: PurchaseReturn = {
      id: `pret-${Date.now()}`,
      return_number: returnNumber,
      invoice_number: 'RETUR-LANGSUNG',
      supplier_id: sup.id,
      supplier_name: sup.name,
      date: new Date().toISOString().split('T')[0],
      items: [{
        product_id: prod.id,
        product_name: prod.name,
        qty: retQty,
        price: prod.buy_price,
        subtotal: totalVal,
        reason: retReason
      }],
      total_return: totalVal,
      action: retAction,
      created_at: new Date().toISOString()
    };

    // 1. Save Return Record
    await db.purchaseReturns.put(newRet);

    // 2. Reduce Stock
    await db.products.update(prod.id, {
      stock: Math.max(0, prod.stock - retQty)
    });

    setIsAddingPurchaseReturn(false);
    setRetSupId('');
    setRetProdId('');
    setRetQty(1);
    await loadData();
    onUpdated?.();
  };

  // Handle Save Sales Return (dari Pelanggan)
  const handleSaveSalesReturn = async () => {
    if (!retSalesProdId || retSalesQty <= 0) return;
    const prod = products.find((p) => p.id === retSalesProdId);
    if (!prod) return;

    const returnNumber = `RET-JUAL-${Date.now().toString().slice(-6)}`;
    const totalRefund = retSalesQty * prod.retail_price;

    const newRet: SalesReturn = {
      id: `sret-${Date.now()}`,
      return_number: returnNumber,
      receipt_number: retReceiptNo.trim() || 'RETUR-LANGSUNG',
      customer_name: retCustName.trim() || 'Pelanggan Umum',
      date: new Date().toISOString().split('T')[0],
      items: [{
        product_id: prod.id,
        product_name: prod.name,
        qty: retSalesQty,
        price: prod.retail_price,
        subtotal: totalRefund,
        reason: retSalesReason
      }],
      total_refund: totalRefund,
      refund_method: 'CASH',
      created_at: new Date().toISOString()
    };

    // 1. Save Return Record
    await db.salesReturns.put(newRet);

    // 2. Restore Stock back to shelf
    await db.products.update(prod.id, {
      stock: prod.stock + retSalesQty
    });

    setIsAddingSalesReturn(false);
    setRetSalesProdId('');
    setRetSalesQty(1);
    setRetReceiptNo('');
    await loadData();
    onUpdated?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight tracking-tight text-white">Histori Pembelian & Retur Barang</h3>
              <p className="text-xs text-[#fcefe3] font-medium mt-0.5">
                Pencatatan faktur masuk distributor, retur barang ke supplier, dan pengembalian belanja pelanggan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip - Coklat Susu Foam Bar */}
        <div className="px-4 py-3 border-b border-[#e4d5c7] bg-[#f5ece3] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'history'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Histori Pembelian ({purchases.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('purchase_return')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'purchase_return'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-200" />
              <span>Retur Pembelian Supplier ({purchaseReturns.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sales_return')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'sales_return'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-amber-200" />
              <span>Retur Penjualan Kasir ({salesReturns.length})</span>
            </button>
          </div>

          <div>
            {activeTab === 'history' && (
              <button
                onClick={() => setIsAddingPurchase(true)}
                className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Input Faktur Beli</span>
              </button>
            )}
            {activeTab === 'purchase_return' && (
              <button
                onClick={() => setIsAddingPurchaseReturn(true)}
                className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retur ke Supplier</span>
              </button>
            )}
            {activeTab === 'sales_return' && (
              <button
                onClick={() => setIsAddingSalesReturn(true)}
                className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retur dari Pelanggan</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-[#f6f0ea] min-h-0">
          
          {/* TAB 1: HISTORI PEMBELIAN */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Form Input Pembelian Baru */}
              {isAddingPurchase && (
                <div className="p-5 bg-[#fcf5ed] border border-[#eed7c4] rounded-3xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Input Faktur Pembelian Masuk Baru</h4>
                    <button onClick={() => setIsAddingPurchase(false)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[#543c2e] block mb-1">Nomor Faktur Beli:</label>
                      <input
                        type="text"
                        value={poInvoice}
                        onChange={(e) => setPoInvoice(e.target.value)}
                        placeholder="contoh: FB-202608-012"
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                    <CustomSelect
                      label="Supplier / Distributor:"
                      value={poSupplierId}
                      onChange={setPoSupplierId}
                      placeholder="-- Pilih Supplier --"
                      options={suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.code})`,
                        sublabel: s.phone ? `Telp: ${s.phone}` : undefined
                      }))}
                    />

                    <CustomSelect
                      label="Metode Pembayaran (Cash / Invoice):"
                      value={poPaymentType}
                      onChange={(val) => {
                        setPoPaymentType(val as any);
                        if (val === 'TEMPO' && !poDueDate) {
                          setPoDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
                        }
                      }}
                      options={[
                        { value: 'CASH', label: '💵 Beli Cash (Tunai Lunas)' },
                        { value: 'TEMPO', label: '📄 Beli Invoice (Tempo / Hutang)' }
                      ]}
                    />

                    {poPaymentType === 'TEMPO' && (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="font-bold text-[#543c2e] block text-xs">
                          Jatuh Tempo Berapa Lama:
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { days: 7, label: '7 Hari' },
                            { days: 14, label: '14 Hari' },
                            { days: 30, label: '30 Hari' },
                            { days: 45, label: '45 Hari' },
                            { days: 60, label: '60 Hari' }
                          ].map(({ days, label }) => {
                            const target = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
                            const isSelected = poDueDate === target;
                            return (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setPoDueDate(target)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                                  isSelected
                                    ? 'bg-[#96633b] text-white border-[#96633b] shadow-2xs'
                                    : 'bg-white hover:bg-[#faebd7] text-[#5c3c26] border-[#dfcebe]'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                          <input
                            type="date"
                            value={poDueDate}
                            onChange={(e) => setPoDueDate(e.target.value)}
                            className="px-2.5 py-1.5 border border-[#dfcebe] rounded-xl bg-white font-mono text-xs"
                          />
                          {poDueDate && (
                            <span className="text-[11px] font-bold text-[#96633b] bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                              📅 Tempo: {new Date(poDueDate).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Product Items into Purchase */}
                  <div className="p-3.5 bg-white rounded-2xl border border-[#eed7c4] space-y-3">
                    <span className="text-xs font-bold text-[#543c2e] block">Tambah Item Barang ke Faktur:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-start">
                      <div className="sm:col-span-2 relative">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Cari nama barang / barcode..."
                            value={poProductSearch}
                            onFocus={() => setIsPoSearching(true)}
                            onChange={(e) => {
                              setPoProductSearch(e.target.value);
                              setIsPoSearching(true);
                            }}
                            className="w-full pl-8 pr-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-medium focus:border-[#96633b]"
                          />
                        </div>

                        {/* Dropdown Suggestions */}
                        {isPoSearching && poSearchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1 space-y-1">
                            {poSearchResults.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setPoSelectedProdId(p.id);
                                  setPoProductSearch(`${p.name} (${formatRupiah(p.buy_price)})`);
                                  setIsPoSearching(false);
                                }}
                                className="p-2 rounded-lg hover:bg-[#fcf5ed] cursor-pointer flex items-center justify-between transition-colors text-xs border border-transparent hover:border-[#eed7c4]"
                              >
                                <div>
                                  <div className="font-bold text-[#3d2617]">{p.name}</div>
                                  <div className="text-[10px] text-[#8a6b53] font-mono">{p.barcode || p.id} • Rak: {p.rack_location}</div>
                                </div>
                                <span className="font-mono font-bold text-[#7c4e2f] text-[11px]">
                                  {formatRupiah(p.buy_price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <input
                          type="number"
                          min="1"
                          value={poQty}
                          onChange={(e) => setPoQty(Number(e.target.value))}
                          placeholder="Qty..."
                          className="w-full px-3 py-2 text-xs border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                        />
                      </div>
                      <button
                        onClick={() => {
                          handleAddItemToPo();
                          setPoProductSearch('');
                        }}
                        disabled={!poSelectedProdId}
                        className="px-4 py-2 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
                      >
                        + Tambah Item
                      </button>
                    </div>

                    {/* Table Draft Items */}
                    {poItems.length > 0 && (
                      <table className="w-full text-left text-xs divide-y divide-[#f0e4d7] mt-2">
                        <thead>
                          <tr className="text-[#856b59] text-[10px] uppercase font-black">
                            <th className="py-2">Produk</th>
                            <th className="py-2 text-right">Qty</th>
                            <th className="py-2 text-right">Harga Beli</th>
                            <th className="py-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0e4d7] font-medium">
                          {poItems.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-2 font-bold text-[#332219]">{it.product.name}</td>
                              <td className="py-2 text-right font-mono">{it.qty}</td>
                              <td className="py-2 text-right font-mono">{formatRupiah(it.buy_price)}</td>
                              <td className="py-2 text-right font-mono font-bold text-[#7c4e2f]">{formatRupiah(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#dfcebe] font-black">
                            <td colSpan={3} className="py-2 text-right text-[#332219]">TOTAL FAKTUR BELI:</td>
                            <td className="py-2 text-right font-mono text-[#7c4e2f] text-sm">
                              {formatRupiah(poItems.reduce((acc, it) => acc + it.subtotal, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setIsAddingPurchase(false)}
                      className="px-4 py-2 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSavePurchase}
                      className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan & Tambah Stok Masuk
                    </button>
                  </div>
                </div>
              )}

              {/* Table Purchases */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider">
                        <th className="py-3 px-4">No. Faktur</th>
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Supplier</th>
                        <th className="py-3 px-4 text-center">Metode Bayar</th>
                        <th className="py-3 px-4">Rincian Item</th>
                        <th className="py-3 px-4 text-right">Total Pembelian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {purchases.map((p) => (
                        <tr key={p.id} className="hover:bg-[#fcf8f4] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#332219]">{p.invoice_number}</td>
                          <td className="py-3 px-4 text-[#856b59]">{p.date}</td>
                          <td className="py-3 px-4 font-bold text-[#332219]">{p.supplier_name}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                              p.payment_type === 'CASH' ? 'bg-[#edf5ee] text-[#166534] border-[#cce2cf]' : 'bg-[#faebd7] text-[#7c4e2f] border-[#eed7c4]'
                            }`}>
                              {p.payment_type === 'CASH' ? 'TUNAI' : `TEMPO (${p.due_date})`}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-[#543c2e]">
                              {p.items.map((it: any, idx: number) => (
                                <span key={idx} className="inline-block bg-[#f5ece3] border border-[#dfcebe] px-2 py-0.5 rounded-md text-[10px] mr-1 mb-1">
                                  {it.product_name} ({it.qty}x)
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-[#7c4e2f] text-sm">
                            {formatRupiah(p.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: RETUR PEMBELIAN KE SUPPLIER */}
          {activeTab === 'purchase_return' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Form Input Retur Supplier */}
              {isAddingPurchaseReturn && (
                <div className="p-5 bg-[#fcf5ed] border border-[#eed7c4] rounded-3xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Form Pengembalian Barang ke Supplier (Retur Beli)</h4>
                    <button onClick={() => setIsAddingPurchaseReturn(false)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <CustomSelect
                      label="Supplier Tujuan:"
                      value={retSupId}
                      onChange={setRetSupId}
                      placeholder="-- Pilih Supplier --"
                      options={suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.code})`,
                        sublabel: s.phone ? `Telp: ${s.phone}` : undefined
                      }))}
                    />

                    <div className="relative">
                      <label className="font-bold text-[#543c2e] block mb-1">Produk yang Diretur:</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cari produk..."
                          value={retPurchaseProductSearch}
                          onFocus={() => setIsRetPurchaseSearching(true)}
                          onChange={(e) => {
                            setRetPurchaseProductSearch(e.target.value);
                            setIsRetPurchaseSearching(true);
                          }}
                          className="w-full pl-8 pr-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-medium text-xs focus:border-[#96633b]"
                        />
                      </div>

                      {/* Dropdown Suggestions */}
                      {isRetPurchaseSearching && retPurchaseSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1 space-y-1">
                          {retPurchaseSearchResults.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setRetProdId(p.id);
                                setRetPurchaseProductSearch(`${p.name} (Stok: ${p.stock})`);
                                setIsRetPurchaseSearching(false);
                              }}
                              className="p-2 rounded-lg hover:bg-[#fcf5ed] cursor-pointer flex items-center justify-between transition-colors text-xs border border-transparent hover:border-[#eed7c4]"
                            >
                              <div>
                                <div className="font-bold text-[#3d2617]">{p.name}</div>
                                <div className="text-[10px] text-[#8a6b53] font-mono">{p.barcode || p.id}</div>
                              </div>
                              <span className="font-mono font-bold text-[#7c4e2f] text-[11px]">
                                Stok: {p.stock} {p.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="font-bold text-[#543c2e] block mb-1">Jumlah Qty Retur:</label>
                      <input
                        type="number"
                        min="1"
                        value={retQty}
                        onChange={(e) => setRetQty(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[#543c2e] block mb-1">Alasan Pengembalian:</label>
                      <input
                        type="text"
                        value={retReason}
                        onChange={(e) => setRetReason(e.target.value)}
                        placeholder="contoh: Kemasan bocor / expired..."
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                    <CustomSelect
                      label="Kompensasi Nilai Retur:"
                      value={retAction}
                      onChange={(val) => setRetAction(val as any)}
                      options={[
                        { value: 'POTONG_HUTANG', label: 'Potong Saldo Hutang ke Supplier' },
                        { value: 'KEMBALI_TUNAI', label: 'Pengembalian Uang Tunai (Cash)' }
                      ]}
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setIsAddingPurchaseReturn(false)}
                      className="px-4 py-2 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSavePurchaseReturn}
                      className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan Retur & Potong Stok
                    </button>
                  </div>
                </div>
              )}

              {/* Table Purchase Returns */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider">
                        <th className="py-3 px-4">No. Retur</th>
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Supplier</th>
                        <th className="py-3 px-4">Item & Alasan</th>
                        <th className="py-3 px-4 text-center">Tindakan</th>
                        <th className="py-3 px-4 text-right">Total Nilai Retur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {purchaseReturns.map((pr) => (
                        <tr key={pr.id} className="hover:bg-[#fcf8f4] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#332219]">{pr.return_number}</td>
                          <td className="py-3 px-4 text-[#856b59]">{pr.date}</td>
                          <td className="py-3 px-4 font-bold text-[#332219]">{pr.supplier_name}</td>
                          <td className="py-3 px-4">
                            {pr.items.map((it, idx) => (
                              <div key={idx} className="text-[#543c2e]">
                                <span className="font-bold">{it.product_name}</span> ({it.qty} pcs)
                                <div className="text-[11px] text-[#856b59]">Alasan: {it.reason}</div>
                              </div>
                            ))}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4]">
                              {pr.action === 'POTONG_HUTANG' ? 'POTONG HUTANG' : 'KEMBALI TUNAI'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-rose-800 text-sm">
                            {formatRupiah(pr.total_return)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: RETUR PENJUALAN KASIR */}
          {activeTab === 'sales_return' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Form Input Retur Penjualan */}
              {isAddingSalesReturn && (
                <div className="p-5 bg-[#fcf5ed] border border-[#eed7c4] rounded-3xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Form Retur Belanja dari Pelanggan (Retur Jual)</h4>
                    <button onClick={() => setIsAddingSalesReturn(false)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[#543c2e] block mb-1">No. Struk Nota Asli:</label>
                      <input
                        type="text"
                        value={retReceiptNo}
                        onChange={(e) => setRetReceiptNo(e.target.value)}
                        placeholder="contoh: TK-20260828-101"
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[#543c2e] block mb-1">Nama Pelanggan:</label>
                      <input
                        type="text"
                        value={retCustName}
                        onChange={(e) => setRetCustName(e.target.value)}
                        placeholder="Pelanggan umum..."
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>

                    <div className="relative">
                      <label className="font-bold text-[#543c2e] block mb-1">Produk yang Dikembalikan:</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cari produk..."
                          value={retSalesProductSearch}
                          onFocus={() => setIsRetSalesSearching(true)}
                          onChange={(e) => {
                            setRetSalesProductSearch(e.target.value);
                            setIsRetSalesSearching(true);
                          }}
                          className="w-full pl-8 pr-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-medium text-xs focus:border-[#96633b]"
                        />
                      </div>

                      {/* Dropdown Suggestions */}
                      {isRetSalesSearching && retSalesSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1 space-y-1">
                          {retSalesSearchResults.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setRetSalesProdId(p.id);
                                setRetSalesProductSearch(`${p.name} (${formatRupiah(p.retail_price)})`);
                                setIsRetSalesSearching(false);
                              }}
                              className="p-2 rounded-lg hover:bg-[#fcf5ed] cursor-pointer flex items-center justify-between transition-colors text-xs border border-transparent hover:border-[#eed7c4]"
                            >
                              <div>
                                <div className="font-bold text-[#3d2617]">{p.name}</div>
                                <div className="text-[10px] text-[#8a6b53] font-mono">{p.barcode || p.id}</div>
                              </div>
                              <span className="font-mono font-bold text-[#7c4e2f] text-[11px]">
                                {formatRupiah(p.retail_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[#543c2e] block mb-1">Jumlah Qty Retur:</label>
                      <input
                        type="number"
                        min="1"
                        value={retSalesQty}
                        onChange={(e) => setRetSalesQty(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-mono font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-[#543c2e] block mb-1">Alasan Retur / Penukaran:</label>
                      <input
                        type="text"
                        value={retSalesReason}
                        onChange={(e) => setRetSalesReason(e.target.value)}
                        placeholder="contoh: Salah ukuran / kemasan bocor..."
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setIsAddingSalesReturn(false)}
                      className="px-4 py-2 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveSalesReturn}
                      className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan Retur & Pulihkan Stok
                    </button>
                  </div>
                </div>
              )}

              {/* Table Sales Returns */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[10px] font-black uppercase tracking-wider">
                        <th className="py-3 px-4">No. Retur</th>
                        <th className="py-3 px-4">Tanggal & Nota Asli</th>
                        <th className="py-3 px-4">Nama Pelanggan</th>
                        <th className="py-3 px-4">Item & Alasan</th>
                        <th className="py-3 px-4 text-right">Dana Dikembalikan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {salesReturns.map((sr) => (
                        <tr key={sr.id} className="hover:bg-[#fcf8f4] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#332219]">{sr.return_number}</td>
                          <td className="py-3 px-4">
                            <div className="text-[#332219] font-semibold">{sr.date}</div>
                            <div className="text-[11px] text-[#856b59] font-mono">Nota: {sr.receipt_number}</div>
                          </td>
                          <td className="py-3 px-4 font-bold text-[#332219]">{sr.customer_name}</td>
                          <td className="py-3 px-4">
                            {sr.items.map((it, idx) => (
                              <div key={idx} className="text-[#543c2e]">
                                <span className="font-bold">{it.product_name}</span> ({it.qty} pcs)
                                <div className="text-[11px] text-[#856b59]">Alasan: {it.reason}</div>
                              </div>
                            ))}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-rose-800 text-sm">
                            {formatRupiah(sr.total_refund)}
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
          <span>Semua transaksi retur otomatis menyesuaikan kartu stok dan jurnal kas</span>
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
