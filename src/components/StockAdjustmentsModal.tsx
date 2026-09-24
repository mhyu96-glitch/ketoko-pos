import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Layers, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ClipboardCheck, 
  Plus, 
  Search, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { db } from '../db';
import type { StockMovement, Product } from '../types';
import { CustomSelect } from './CustomSelect';
import { syncService } from '../services/syncService';

interface StockAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'in' | 'out' | 'opname';
  onUpdated?: () => void;
}

export const StockAdjustmentsModal: React.FC<StockAdjustmentsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'in',
  onUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'in' | 'out' | 'opname'>(initialTab);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // State: Add Item IN
  const [isAddingIn, setIsAddingIn] = useState(false);
  const [inProdId, setInProdId] = useState('');
  const [inProductSearch, setInProductSearch] = useState('');
  const [isSearchingIn, setIsSearchingIn] = useState(false);
  const [inQty, setInQty] = useState<number>(1);
  const [inCategory, setInCategory] = useState<'BONUS_SALES' | 'SAMPLE' | 'LAINNYA'>('BONUS_SALES');
  const [inNotes, setInNotes] = useState('');

  // State: Add Item OUT
  const [isAddingOut, setIsAddingOut] = useState(false);
  const [outProdId, setOutProdId] = useState('');
  const [outProductSearch, setOutProductSearch] = useState('');
  const [isSearchingOut, setIsSearchingOut] = useState(false);
  const [outQty, setOutQty] = useState<number>(1);
  const [outCategory, setOutCategory] = useState<'HADIAH_ORANG' | 'RUSAK' | 'EXPIRED' | 'LAINNYA'>('HADIAH_ORANG');
  const [outNotes, setOutNotes] = useState('');

  // State: Stok Opname
  const [opnameSearch, setOpnameSearch] = useState('');
  const [opnamePage, setOpnamePage] = useState(1);
  const OPNAME_PAGE_SIZE = 50;
  const [opnameCounts, setOpnameCounts] = useState<{ [productId: string]: number }>({});
  const [opnameSuccess, setOpnameSuccess] = useState(false);

  // Fast autocomplete search results for Item IN (top 8)
  const inSearchResults = useMemo(() => {
    const q = inProductSearch.toLowerCase().trim();
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
  }, [products, inProductSearch]);

  // Fast autocomplete search results for Item OUT (top 8)
  const outSearchResults = useMemo(() => {
    const q = outProductSearch.toLowerCase().trim();
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
  }, [products, outProductSearch]);

  // Filtered products for Opname
  const filteredOpnameProducts = useMemo(() => {
    const q = opnameSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
  }, [products, opnameSearch]);

  // Paginated slice for Opname (instant render of 50 items)
  const paginatedOpnameProducts = useMemo(() => {
    const start = (opnamePage - 1) * OPNAME_PAGE_SIZE;
    return filteredOpnameProducts.slice(start, start + OPNAME_PAGE_SIZE);
  }, [filteredOpnameProducts, opnamePage]);

  const opnameTotalPages = Math.ceil(filteredOpnameProducts.length / OPNAME_PAGE_SIZE) || 1;

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
    }
  }, [isOpen, initialTab]);

  const loadData = async () => {
    const allMov = await db.stockMovements.toArray();
    const allProd = await db.products.toArray();
    setMovements(allMov);
    setProducts(allProd);

    // Init opname count map
    const map: { [id: string]: number } = {};
    allProd.forEach((p) => {
      map[p.id] = p.stock;
    });
    setOpnameCounts(map);
  };

  // Save Item IN (Bonus / Sampel)
  const handleSaveItemIn = async () => {
    if (!inProdId || inQty <= 0) return;
    const prod = products.find((p) => p.id === inProdId);
    if (!prod) return;

    const newStock = prod.stock + inQty;

    const newMov: StockMovement = {
      id: `mov-${Date.now()}`,
      product_id: prod.id,
      product_name: prod.name,
      barcode: prod.barcode,
      type: 'IN',
      qty: inQty,
      reason_category: inCategory,
      notes: inNotes.trim() || `Item masuk: ${inCategory}`,
      current_stock: newStock,
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    // 1. Save movement
    await db.stockMovements.put(newMov);

    // 2. Increase stock & sync everywhere
    await syncService.syncProductChange({
      ...prod,
      stock: newStock
    });

    setIsAddingIn(false);
    setInProdId('');
    setInQty(1);
    setInNotes('');
    await loadData();
    onUpdated?.();
  };

  // Save Item OUT (Hadiah Orang / Rusak / Expired)
  const handleSaveItemOut = async () => {
    if (!outProdId || outQty <= 0) return;
    const prod = products.find((p) => p.id === outProdId);
    if (!prod) return;

    const newStock = Math.max(0, prod.stock - outQty);

    const newMov: StockMovement = {
      id: `mov-${Date.now()}`,
      product_id: prod.id,
      product_name: prod.name,
      barcode: prod.barcode,
      type: 'OUT',
      qty: outQty,
      reason_category: outCategory,
      notes: outNotes.trim() || `Item keluar: ${outCategory}`,
      current_stock: newStock,
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    // 1. Save movement
    await db.stockMovements.put(newMov);

    // 2. Decrease stock & sync everywhere
    await syncService.syncProductChange({
      ...prod,
      stock: newStock
    });

    setIsAddingOut(false);
    setOutProdId('');
    setOutQty(1);
    setOutNotes('');
    await loadData();
    onUpdated?.();
  };

  // Apply Stok Opname
  const handleApplyOpname = async () => {
    for (const [prodId, physicalCount] of Object.entries(opnameCounts)) {
      const prod = products.find((p) => p.id === prodId);
      if (prod && prod.stock !== physicalCount) {
        const diff = physicalCount - prod.stock;
        // Record Opname adjustment movement
        await db.stockMovements.put({
          id: `opn-${Date.now()}-${prod.id}`,
          product_id: prod.id,
          product_name: prod.name,
          barcode: prod.barcode,
          type: diff >= 0 ? 'IN' : 'OUT',
          qty: Math.abs(diff),
          reason_category: 'OPNAME_ADJUSTMENT',
          notes: `Stok opname fisik: ${prod.stock} -> ${physicalCount} (selisih ${diff})`,
          current_stock: physicalCount,
          date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        });

        // Update product stock to real physical count & sync everywhere
        await syncService.syncProductChange({
          ...prod,
          stock: physicalCount
        });
      }
    }

    setOpnameSuccess(true);
    setTimeout(() => setOpnameSuccess(false), 4000);
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
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight tracking-tight text-white">Mutasi Item & Stok Opname Fisik</h3>
              <p className="text-xs text-[#fcefe3] font-medium mt-0.5">
                Pencatatan bonus sales (item masuk), hadiah/rusak (item keluar), dan rekonsiliasi stok opname
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
              onClick={() => setActiveTab('in')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'in'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-amber-200" />
              <span>Item Masuk (Bonus/Sampel)</span>
            </button>

            <button
              onClick={() => setActiveTab('out')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'out'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-200" />
              <span>Item Keluar (Hadiah/Rusak)</span>
            </button>

            <button
              onClick={() => setActiveTab('opname')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'opname'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-200" />
              <span>Stok Opname Fisik</span>
            </button>
          </div>

          <div>
            {activeTab === 'in' && (
              <button
                onClick={() => setIsAddingIn(true)}
                className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Item Masuk</span>
              </button>
            )}
            {activeTab === 'out' && (
              <button
                onClick={() => setIsAddingOut(true)}
                className="px-3.5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Item Keluar</span>
              </button>
            )}
            {activeTab === 'opname' && (
              <button
                onClick={handleApplyOpname}
                className="px-4 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                <span>Terapkan Hasil Opname</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-[#f6f0ea] min-h-0">
          
          {/* TAB 1: ITEM MASUK */}
          {activeTab === 'in' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Form Input Item Masuk */}
              {isAddingIn && (
                <div className="p-5 bg-[#fcf5ed] border border-[#eed7c4] rounded-3xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Form Catat Item Masuk Non-Beli</h4>
                    <button onClick={() => setIsAddingIn(false)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="relative">
                      <label className="font-bold text-[#543c2e] block mb-1">Pilih / Cari Produk:</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cari nama / barcode..."
                          value={inProductSearch}
                          onFocus={() => setIsSearchingIn(true)}
                          onChange={(e) => {
                            setInProductSearch(e.target.value);
                            setIsSearchingIn(true);
                          }}
                          className="w-full pl-8 pr-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-medium text-xs focus:border-[#96633b]"
                        />
                      </div>

                      {/* Dropdown Suggestions */}
                      {isSearchingIn && inSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1 space-y-1">
                          {inSearchResults.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setInProdId(p.id);
                                setInProductSearch(`${p.name} (Stok: ${p.stock})`);
                                setIsSearchingIn(false);
                              }}
                              className="p-2 rounded-lg hover:bg-[#fcf5ed] cursor-pointer flex items-center justify-between transition-colors text-xs border border-transparent hover:border-[#eed7c4]"
                            >
                              <div>
                                <div className="font-bold text-[#3d2617]">{p.name}</div>
                                <div className="text-[10px] text-[#8a6b53] font-mono">{p.barcode || p.id} • Rak: {p.rack_location}</div>
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
                      <label className="font-bold text-[#543c2e] block mb-1">Jumlah Masuk (Qty):</label>
                      <input
                        type="number"
                        min="1"
                        value={inQty}
                        onChange={(e) => setInQty(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-mono font-bold text-xs"
                      />
                    </div>

                    <CustomSelect
                      label="Kategori Alasan Masuk:"
                      value={inCategory}
                      onChange={(val) => setInCategory(val as any)}
                      options={[
                        { value: 'BONUS_SALES', label: 'Bonus dari Sales Distributor' },
                        { value: 'SAMPLE', label: 'Sampel Gratis / Tester Pabrik' },
                        { value: 'LAINNYA', label: 'Koreksi Stok Tambah / Hibah' }
                      ]}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#543c2e] block mb-1 text-xs">Keterangan / Catatan:</label>
                    <input
                      type="text"
                      value={inNotes}
                      onChange={(e) => setInNotes(e.target.value)}
                      placeholder="contoh: Bonus 10 pcs dari Sales Indofood target bulanan..."
                      className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white text-xs font-medium"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setIsAddingIn(false)}
                      className="px-4 py-2 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveItemIn}
                      className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan & Tambah Stok
                    </button>
                  </div>
                </div>
              )}

              {/* Table Movement IN */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[11px] font-black uppercase tracking-wider">
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Produk & Barcode</th>
                        <th className="py-3 px-4">Kategori Alasan</th>
                        <th className="py-3 px-4">Catatan</th>
                        <th className="py-3 px-4 text-right">Qty Masuk</th>
                        <th className="py-3 px-4 text-right">Stok Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {movements.filter((m) => m.type === 'IN').map((m) => (
                        <tr key={m.id} className="hover:bg-[#fcf8f4] transition-colors">
                          <td className="py-3 px-4 text-[#856b59]">{m.date}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#332219] text-sm">{m.product_name}</div>
                            <div className="text-[11px] text-[#856b59] font-mono">{m.barcode}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#edf5ee] text-[#166534] border border-[#cce2cf]">
                              {m.reason_category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#543c2e]">{m.notes}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-[#166534] text-sm">
                            +{m.qty}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[#332219] font-bold">
                            {m.current_stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ITEM KELUAR */}
          {activeTab === 'out' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Form Input Item Keluar */}
              {isAddingOut && (
                <div className="p-5 bg-[#fcf5ed] border border-[#eed7c4] rounded-3xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Form Catat Item Keluar Non-Jual</h4>
                    <button onClick={() => setIsAddingOut(false)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="relative">
                      <label className="font-bold text-[#543c2e] block mb-1">Pilih / Cari Produk:</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cari nama / barcode..."
                          value={outProductSearch}
                          onFocus={() => setIsSearchingOut(true)}
                          onChange={(e) => {
                            setOutProductSearch(e.target.value);
                            setIsSearchingOut(true);
                          }}
                          className="w-full pl-8 pr-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-medium text-xs focus:border-[#96633b]"
                        />
                      </div>

                      {/* Dropdown Suggestions */}
                      {isSearchingOut && outSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1 space-y-1">
                          {outSearchResults.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setOutProdId(p.id);
                                setOutProductSearch(`${p.name} (Stok: ${p.stock})`);
                                setIsSearchingOut(false);
                              }}
                              className="p-2 rounded-lg hover:bg-[#fcf5ed] cursor-pointer flex items-center justify-between transition-colors text-xs border border-transparent hover:border-[#eed7c4]"
                            >
                              <div>
                                <div className="font-bold text-[#3d2617]">{p.name}</div>
                                <div className="text-[10px] text-[#8a6b53] font-mono">{p.barcode || p.id} • Rak: {p.rack_location}</div>
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
                      <label className="font-bold text-[#543c2e] block mb-1">Jumlah Keluar (Qty):</label>
                      <input
                        type="number"
                        min="1"
                        value={outQty}
                        onChange={(e) => setOutQty(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white font-mono font-bold text-xs"
                      />
                    </div>

                    <CustomSelect
                      label="Kategori Alasan Keluar:"
                      value={outCategory}
                      onChange={(val) => setOutCategory(val as any)}
                      options={[
                        { value: 'HADIAH_ORANG', label: 'Diberikan ke Tamu / Hadiah' },
                        { value: 'RUSAK', label: 'Barang Pecah / Kemasan Rusak' },
                        { value: 'EXPIRED', label: 'Barang Kadaluarsa (Expired)' },
                        { value: 'LAINNYA', label: 'Konsumsi Operasional Toko' }
                      ]}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#543c2e] block mb-1 text-xs">Keterangan / Catatan:</label>
                    <input
                      type="text"
                      value={outNotes}
                      onChange={(e) => setOutNotes(e.target.value)}
                      placeholder="contoh: Diberikan untuk konsumsi tamu / CSR lingkungan sekitar toko..."
                      className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-white text-xs font-medium"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setIsAddingOut(false)}
                      className="px-4 py-2 bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] rounded-xl text-xs font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveItemOut}
                      className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Simpan & Kurangi Stok
                    </button>
                  </div>
                </div>
              )}

              {/* Table Movement OUT */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[11px] font-black uppercase tracking-wider">
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Produk & Barcode</th>
                        <th className="py-3 px-4">Kategori Alasan</th>
                        <th className="py-3 px-4">Catatan</th>
                        <th className="py-3 px-4 text-right">Qty Keluar</th>
                        <th className="py-3 px-4 text-right">Stok Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {movements.filter((m) => m.type === 'OUT').map((m) => (
                        <tr key={m.id} className="hover:bg-[#fcf8f4] transition-colors">
                          <td className="py-3 px-4 text-[#856b59]">{m.date}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#332219] text-sm">{m.product_name}</div>
                            <div className="text-[11px] text-[#856b59] font-mono">{m.barcode}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4]">
                              {m.reason_category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#543c2e]">{m.notes}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-rose-800 text-sm">
                            -{m.qty}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[#332219] font-bold">
                            {m.current_stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: STOK OPNAME FISIK */}
          {activeTab === 'opname' && (
            <div className="space-y-4 animate-fadeIn">
              
              {opnameSuccess && (
                <div className="p-3.5 bg-[#edf5ee] border border-[#cce2cf] text-[#166534] rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                  <span>Stok Opname Berhasil Disimpan! Seluruh stok sistem telah diselaraskan dengan perhitungan fisik di rak.</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <ClipboardCheck className="w-5 h-5 text-[#7c4e2f]" />
                  <div>
                    <h4 className="font-extrabold text-sm text-[#332219]">Audit & Penyesuaian Stok Fisik</h4>
                    <p className="text-[11px] text-[#856b59]">Ketikkan jumlah hitungan fisik di kolom "Hitungan Fisik Riil"</p>
                  </div>
                </div>

                <div className="relative w-72">
                  <Search className="w-4 h-4 text-[#856b59] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={opnameSearch}
                    onChange={(e) => setOpnameSearch(e.target.value)}
                    placeholder="Cari produk / barcode..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dfcebe] text-xs focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20 bg-white"
                  />
                </div>
              </div>

              {/* Table Opname Grid */}
              <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f1e5d8] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#634837] text-[11px] font-black uppercase tracking-wider">
                        <th className="py-3 px-4">Produk & Lokasi Rak</th>
                        <th className="py-3 px-4 text-right">Stok Sistem</th>
                        <th className="py-3 px-4 text-center">Hitungan Fisik Riil</th>
                        <th className="py-3 px-4 text-right">Selisih (+/-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {paginatedOpnameProducts.map((p) => {
                        const physical = opnameCounts[p.id] ?? p.stock;
                        const diff = physical - p.stock;
                        return (
                          <tr key={p.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm">{p.name}</div>
                              <div className="text-[10px] text-[#856b59] font-mono">{p.barcode} • Rak: {p.rack_location}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#332219] text-sm">
                              {p.stock} {p.unit}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <input
                                type="number"
                                min="0"
                                value={physical}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setOpnameCounts({ ...opnameCounts, [p.id]: val });
                                }}
                                className="w-24 text-center px-2 py-1.5 border border-[#dfcebe] rounded-xl bg-[#fcf8f4] font-mono font-black text-[#332219] text-sm focus:bg-white focus:border-[#7c4e2f]"
                              />
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-sm">
                              {diff === 0 ? (
                                <span className="text-[#a08573]">0 (Sesuai)</span>
                              ) : diff > 0 ? (
                                <span className="text-[#166534]">+{diff} {p.unit} (Lebih)</span>
                              ) : (
                                <span className="text-rose-700">{diff} {p.unit} (Kurang)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Opname Pagination Footer Bar */}
                <div className="px-4 py-3 bg-[#fdfaf7] border-t border-[#eed7c4] flex items-center justify-between text-xs text-[#8a6b53]">
                  <span>
                    Menampilkan <strong>{paginatedOpnameProducts.length > 0 ? (opnamePage - 1) * OPNAME_PAGE_SIZE + 1 : 0} - {Math.min(opnamePage * OPNAME_PAGE_SIZE, filteredOpnameProducts.length)}</strong> dari <strong>{filteredOpnameProducts.length}</strong> produk
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setOpnamePage((prev) => Math.max(1, prev - 1))}
                      disabled={opnamePage === 1}
                      className="px-2.5 py-1 rounded-lg border border-[#dfcebe] bg-white text-[#332219] font-bold disabled:opacity-40 hover:bg-[#faebd7] flex items-center space-x-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <span className="font-mono font-bold text-[#7c4e2f] px-2">
                      {opnamePage} / {opnameTotalPages}
                    </span>

                    <button
                      onClick={() => setOpnamePage((prev) => Math.min(opnameTotalPages, prev + 1))}
                      disabled={opnamePage >= opnameTotalPages}
                      className="px-2.5 py-1 rounded-lg border border-[#dfcebe] bg-white text-[#332219] font-bold disabled:opacity-40 hover:bg-[#faebd7] flex items-center space-x-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e5d0be] bg-white flex items-center justify-between text-xs text-[#8a6b53] shrink-0">
          <span>Riwayat mutasi stok tercatat otomatis untuk mencegah *shrinkage* dan selisih barang</span>
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
