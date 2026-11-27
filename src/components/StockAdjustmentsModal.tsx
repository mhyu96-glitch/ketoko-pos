import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Layers, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ClipboardCheck, 
  Plus, 
  Minus,
  Search, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw
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
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState('ALL');
  const [opnameDiffFilter, setOpnameDiffFilter] = useState<'ALL' | 'CHANGED' | 'ZERO'>('ALL');
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

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  const changedOpnameCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const physical = opnameCounts[p.id] ?? p.stock;
      if (physical !== p.stock) count++;
    }
    return count;
  }, [products, opnameCounts]);

  // Filtered products for Opname
  const filteredOpnameProducts = useMemo(() => {
    const q = opnameSearch.toLowerCase().trim();
    return products.filter((p) => {
      if (opnameCategoryFilter !== 'ALL' && (p.category || '').trim() !== opnameCategoryFilter) {
        return false;
      }
      const physical = opnameCounts[p.id] ?? p.stock;
      if (opnameDiffFilter === 'CHANGED' && physical === p.stock) return false;
      if (opnameDiffFilter === 'ZERO' && p.stock !== 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.rack_location || '').toLowerCase().includes(q)
      );
    });
  }, [products, opnameSearch, opnameCategoryFilter, opnameDiffFilter, opnameCounts]);

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

    await db.stockMovements.put(newMov);
    await syncService.syncProductChange({
      ...prod,
      stock: newStock
    });

    setIsAddingIn(false);
    setInProdId('');
    setInProductSearch('');
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

    await db.stockMovements.put(newMov);
    await syncService.syncProductChange({
      ...prod,
      stock: newStock
    });

    setIsAddingOut(false);
    setOutProdId('');
    setOutProductSearch('');
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

  const inMovements = movements.filter((m) => m.type === 'IN');
  const outMovements = movements.filter((m) => m.type === 'OUT');

  return (
    <div className="fixed inset-0 z-50 bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-xl leading-tight tracking-tight text-white">Mutasi Item &amp; Stok Opname Fisik</h3>
              <p className="text-xs text-[#fcefe3] font-medium mt-0.5">
                Pencatatan bonus sales (item masuk), hadiah/rusak (item keluar), dan rekonsiliasi stok opname
              </p>
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

        {/* Unified Tab & Filter Toolbar */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-[#e4d5c7] bg-[#f5ece3] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('in')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'in'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <ArrowDownToLine className={`w-3.5 h-3.5 ${activeTab === 'in' ? 'text-amber-200' : 'text-[#7c4e2f]'}`} />
              <span>Item Masuk (Bonus/Sampel)</span>
            </button>

            <button
              onClick={() => setActiveTab('out')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'out'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <ArrowUpFromLine className={`w-3.5 h-3.5 ${activeTab === 'out' ? 'text-amber-200' : 'text-[#7c4e2f]'}`} />
              <span>Item Keluar (Hadiah/Rusak)</span>
            </button>

            <button
              onClick={() => setActiveTab('opname')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                activeTab === 'opname'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#ebdccf] border-[#dfcebe]'
              }`}
            >
              <ClipboardCheck className={`w-3.5 h-3.5 ${activeTab === 'opname' ? 'text-amber-200' : 'text-[#7c4e2f]'}`} />
              <span>Stok Opname Fisik</span>
              {changedOpnameCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-[#332219] font-black tabular-nums">
                  {changedOpnameCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'opname' && (
              <>
                <CustomSelect
                  value={opnameDiffFilter}
                  onChange={(val) => {
                    setOpnameDiffFilter(val as any);
                    setOpnamePage(1);
                  }}
                  size="sm"
                  className="min-w-[175px]"
                  options={[
                    { value: 'ALL', label: `Semua Produk (${products.length})` },
                    { value: 'CHANGED', label: `Ada Selisih (${changedOpnameCount})` },
                    { value: 'ZERO', label: `Stok Kosong / 0 (${products.filter((p) => p.stock === 0).length})` },
                  ]}
                />

                {categoryOptions.length > 1 && (
                  <CustomSelect
                    value={opnameCategoryFilter}
                    onChange={(val) => {
                      setOpnameCategoryFilter(val);
                      setOpnamePage(1);
                    }}
                    size="sm"
                    className="min-w-[175px]"
                    options={[
                      { value: 'ALL', label: 'Semua Kategori / Rak' },
                      ...categoryOptions.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                )}

                <div className="relative w-60 sm:w-68">
                  <Search className="w-3.5 h-3.5 text-[#856b59] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={opnameSearch}
                    onChange={(e) => {
                      setOpnameSearch(e.target.value);
                      setOpnamePage(1);
                    }}
                    placeholder="Cari nama produk / barcode..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-[#dfcebe] text-xs font-medium focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20 bg-white"
                  />
                  {opnameSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpnameSearch('');
                        setOpnamePage(1);
                      }}
                      className="absolute right-2 top-2 text-[#8a6b53] hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTab === 'in' && (
              <button
                onClick={() => setIsAddingIn(true)}
                className="px-4 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Catat Item Masuk</span>
              </button>
            )}

            {activeTab === 'out' && (
              <button
                onClick={() => setIsAddingOut(true)}
                className="px-4 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Catat Item Keluar</span>
              </button>
            )}

            {activeTab === 'opname' && (
              <button
                onClick={handleApplyOpname}
                className="px-4 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95 whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                <span>
                  Terapkan Hasil Opname{changedOpnameCount > 0 ? ` (${changedOpnameCount})` : ''}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Full-Height Content Body */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex-1 min-h-0 flex flex-col bg-[#fcf9f5]">
          
          {/* TAB 1: ITEM MASUK */}
          {activeTab === 'in' && (
            <div className="flex-1 min-h-0 flex flex-col gap-4 animate-fadeIn">
              
              {isAddingIn && (
                <div className="p-5 bg-white border border-[#e4d5c7] rounded-2xl shadow-xs space-y-4 shrink-0">
                  <div className="flex items-center justify-between border-b border-[#f0e4d7] pb-2.5">
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Form Catat Item Masuk Non-Beli</h4>
                    <button onClick={() => setIsAddingIn(false)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-4 h-4" />
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
                          className="w-full pl-8 pr-3 py-2 border border-[#dfcebe] rounded-xl bg-[#fcf9f5] focus:bg-white font-medium text-xs focus:border-[#96633b]"
                        />
                      </div>

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
                                <div className="text-[10px] text-[#8a6b53] tabular-nums">{p.barcode || p.id} • Rak: {p.rack_location}</div>
                              </div>
                              <span className="tabular-nums font-bold text-[#7c4e2f] text-[11px]">
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
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-[#fcf9f5] focus:bg-white tabular-nums font-bold text-xs"
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
                      placeholder="Contoh: Bonus 10 pcs dari sales distributor..."
                      className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-[#fcf9f5] focus:bg-white text-xs font-medium"
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
                      Simpan &amp; Tambah Stok
                    </button>
                  </div>
                </div>
              )}

              {/* Table Movement IN */}
              <div className="bg-white rounded-2xl border border-[#e4d5c7] shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="overflow-auto flex-1 custom-scroll">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3.5 px-4">Tanggal</th>
                        <th className="py-3.5 px-4">Produk &amp; Barcode</th>
                        <th className="py-3.5 px-4">Kategori Alasan</th>
                        <th className="py-3.5 px-4">Catatan</th>
                        <th className="py-3.5 px-4 text-right">Qty Masuk</th>
                        <th className="py-3.5 px-4 text-right">Stok Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {inMovements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-[#856b59]">
                            <ArrowDownToLine className="w-9 h-9 mx-auto text-[#dfcebe] mb-2" />
                            <p className="font-bold text-sm text-[#543c2e]">Belum ada riwayat item masuk non-beli</p>
                            <p className="text-xs text-[#856b59] mt-0.5">Klik <b>+ Catat Item Masuk</b> di kanan atas untuk menambahkan.</p>
                          </td>
                        </tr>
                      ) : (
                        inMovements.map((m) => (
                          <tr key={m.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4 text-[#856b59] tabular-nums whitespace-nowrap">{m.date}</td>
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-[#332219] text-xs sm:text-sm">{m.product_name}</div>
                              <div className="text-[11px] text-[#856b59] tabular-nums">{m.barcode}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#edf5ee] text-[#166534] border border-[#cce2cf]">
                                {m.reason_category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#543c2e]">{m.notes}</td>
                            <td className="py-3 px-4 text-right tabular-nums font-extrabold text-[#166534] text-sm whitespace-nowrap">
                              +{m.qty}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-[#332219] font-bold whitespace-nowrap">
                              {m.current_stock}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ITEM KELUAR */}
          {activeTab === 'out' && (
            <div className="flex-1 min-h-0 flex flex-col gap-4 animate-fadeIn">
              
              {isAddingOut && (
                <div className="p-5 bg-white border border-[#e4d5c7] rounded-2xl shadow-xs space-y-4 shrink-0">
                  <div className="flex items-center justify-between border-b border-[#f0e4d7] pb-2.5">
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Form Catat Item Keluar Non-Jual</h4>
                    <button onClick={() => setIsAddingOut(false)} className="text-[#856b59] hover:text-[#332219]">
                      <X className="w-4 h-4" />
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
                          className="w-full pl-8 pr-3 py-2 border border-[#dfcebe] rounded-xl bg-[#fcf9f5] focus:bg-white font-medium text-xs focus:border-[#96633b]"
                        />
                      </div>

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
                                <div className="text-[10px] text-[#8a6b53] tabular-nums">{p.barcode || p.id} • Rak: {p.rack_location}</div>
                              </div>
                              <span className="tabular-nums font-bold text-[#7c4e2f] text-[11px]">
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
                        className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-[#fcf9f5] focus:bg-white tabular-nums font-bold text-xs"
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
                      placeholder="Contoh: Kemasan rusak di gudang..."
                      className="w-full px-3 py-2 border border-[#dfcebe] rounded-xl bg-[#fcf9f5] focus:bg-white text-xs font-medium"
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
                      Simpan &amp; Kurangi Stok
                    </button>
                  </div>
                </div>
              )}

              {/* Table Movement OUT */}
              <div className="bg-white rounded-2xl border border-[#e4d5c7] shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="overflow-auto flex-1 custom-scroll">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3.5 px-4">Tanggal</th>
                        <th className="py-3.5 px-4">Produk &amp; Barcode</th>
                        <th className="py-3.5 px-4">Kategori Alasan</th>
                        <th className="py-3.5 px-4">Catatan</th>
                        <th className="py-3.5 px-4 text-right">Qty Keluar</th>
                        <th className="py-3.5 px-4 text-right">Stok Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {outMovements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-[#856b59]">
                            <ArrowUpFromLine className="w-9 h-9 mx-auto text-[#dfcebe] mb-2" />
                            <p className="font-bold text-sm text-[#543c2e]">Belum ada riwayat item keluar non-jual</p>
                            <p className="text-xs text-[#856b59] mt-0.5">Klik <b>+ Catat Item Keluar</b> di kanan atas untuk menambahkan.</p>
                          </td>
                        </tr>
                      ) : (
                        outMovements.map((m) => (
                          <tr key={m.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4 text-[#856b59] tabular-nums whitespace-nowrap">{m.date}</td>
                            <td className="py-3 px-4">
                              <div className="font-extrabold text-[#332219] text-xs sm:text-sm">{m.product_name}</div>
                              <div className="text-[11px] text-[#856b59] tabular-nums">{m.barcode}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4]">
                                {m.reason_category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#543c2e]">{m.notes}</td>
                            <td className="py-3 px-4 text-right tabular-nums font-extrabold text-rose-700 text-sm whitespace-nowrap">
                              -{m.qty}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-[#332219] font-bold whitespace-nowrap">
                              {m.current_stock}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: STOK OPNAME FISIK */}
          {activeTab === 'opname' && (
            <div className="flex-1 min-h-0 flex flex-col gap-3 animate-fadeIn">
              
              {opnameSuccess && (
                <div className="p-3 bg-[#edf5ee] border border-[#cce2cf] text-[#166534] rounded-xl text-xs font-bold flex items-center space-x-2 shrink-0 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                  <span>Stok Opname berhasil disimpan! Seluruh stok sistem telah diselaraskan dengan perhitungan fisik di rak.</span>
                </div>
              )}

              {/* Full-Height Opname Table Card */}
              <div className="bg-white rounded-2xl border border-[#e4d5c7] shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="overflow-auto flex-1 custom-scroll">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <colgroup>
                      <col className="w-auto" />
                      <col className="w-40 sm:w-44" />
                      <col className="w-48 sm:w-56" />
                      <col className="w-44 sm:w-52" />
                    </colgroup>
                    <thead className="sticky top-0 bg-[#f5ece3] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3.5 px-5 text-left">Produk &amp; Lokasi Rak</th>
                        <th className="py-3.5 px-4 text-right">Stok Sistem</th>
                        <th className="py-3.5 px-4 text-center">Hitungan Fisik Riil</th>
                        <th className="py-3.5 px-5 text-right">Selisih (+/-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7]">
                      {paginatedOpnameProducts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-16 text-center text-[#856b59]">
                            <ClipboardCheck className="w-9 h-9 mx-auto text-[#dfcebe] mb-2" />
                            <p className="font-bold text-sm text-[#543c2e]">Tidak ada produk yang cocok dengan filter</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedOpnameProducts.map((p) => {
                          const physical = opnameCounts[p.id] ?? p.stock;
                          const diff = physical - p.stock;
                          const isModified = diff !== 0;

                          return (
                            <tr
                              key={p.id}
                              className={`transition-colors ${
                                isModified ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-[#fcf8f4]'
                              }`}
                            >
                              {/* Produk & Lokasi Rak */}
                              <td className="py-2.5 px-5 align-middle">
                                <div className="font-extrabold text-[#332219] text-xs sm:text-sm truncate">{p.name}</div>
                                <div className="flex items-center gap-2 text-[11px] text-[#856b59] mt-0.5">
                                  <span className="tabular-nums font-semibold text-[#7c4e2f]">{p.barcode || p.id}</span>
                                  <span>•</span>
                                  <span className="truncate">Rak: {p.rack_location || p.category || 'Umum'}</span>
                                </div>
                              </td>

                              {/* Stok Sistem */}
                              <td className="py-2.5 px-4 text-right align-middle whitespace-nowrap">
                                <span className="tabular-nums font-extrabold text-[#332219] text-sm">
                                  {p.stock.toLocaleString('id-ID')}
                                </span>{' '}
                                <span className="text-[10px] font-bold uppercase text-[#8a6b53]">
                                  {p.unit || 'PCS'}
                                </span>
                              </td>

                              {/* Hitungan Fisik Riil (Perfectly Centered Stepper + Input) */}
                              <td className="py-2.5 px-4 text-center align-middle">
                                <div className="inline-flex items-center justify-center gap-1 mx-auto">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpnameCounts((prev) => ({
                                        ...prev,
                                        [p.id]: Math.max(0, (prev[p.id] ?? p.stock) - 1),
                                      }))
                                    }
                                    className="w-7 h-8 rounded-lg border border-[#dfcebe] bg-[#fcf9f5] hover:bg-[#faebd7] text-[#543c2e] flex items-center justify-center transition-colors active:scale-95"
                                    title="Kurangi 1"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>

                                  <input
                                    type="number"
                                    min="0"
                                    value={physical}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value) || 0);
                                      setOpnameCounts((prev) => ({ ...prev, [p.id]: val }));
                                    }}
                                    className={`w-20 h-8 text-center px-2 border rounded-xl tabular-nums font-extrabold text-sm focus:outline-none focus:ring-2 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                      isModified
                                        ? 'bg-white border-amber-400 text-[#332219] focus:border-amber-600 focus:ring-amber-500/20'
                                        : 'bg-[#fcf8f4] border-[#dfcebe] text-[#332219] focus:bg-white focus:border-[#7c4e2f] focus:ring-[#7c4e2f]/20'
                                    }`}
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpnameCounts((prev) => ({
                                        ...prev,
                                        [p.id]: (prev[p.id] ?? p.stock) + 1,
                                      }))
                                    }
                                    className="w-7 h-8 rounded-lg border border-[#dfcebe] bg-[#fcf9f5] hover:bg-[#faebd7] text-[#543c2e] flex items-center justify-center transition-colors active:scale-95"
                                    title="Tambah 1"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>

                                  {isModified && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpnameCounts((prev) => ({ ...prev, [p.id]: p.stock }))
                                      }
                                      className="p-1 text-[#8a6b53] hover:text-rose-600 transition-colors"
                                      title="Kembalikan ke stok sistem"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Selisih (+/-) */}
                              <td className="py-2.5 px-5 text-right align-middle whitespace-nowrap">
                                {diff === 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 tabular-nums">
                                    Sesuai (0)
                                  </span>
                                ) : diff > 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                                    +{diff.toLocaleString('id-ID')} {p.unit} (Lebih)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                                    {diff.toLocaleString('id-ID')} {p.unit} (Kurang)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Opname Pagination & Info Footer Bar */}
                <div className="px-5 py-3 bg-[#fdfaf7] border-t border-[#e4d5c7] flex flex-wrap items-center justify-between gap-2 text-xs text-[#8a6b53] shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">
                      Menampilkan <strong className="text-[#332219]">{paginatedOpnameProducts.length > 0 ? (opnamePage - 1) * OPNAME_PAGE_SIZE + 1 : 0}–{Math.min(opnamePage * OPNAME_PAGE_SIZE, filteredOpnameProducts.length)}</strong> dari <strong className="text-[#332219]">{filteredOpnameProducts.length}</strong> produk
                    </span>
                    <span className="hidden md:inline text-[#dfcebe]">•</span>
                    <span className="hidden md:inline">
                      Riwayat mutasi stok tercatat otomatis untuk mencegah penyusutan stok (shrinkage) dan selisih barang
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setOpnamePage((prev) => Math.max(1, prev - 1))}
                      disabled={opnamePage === 1}
                      className="px-3 py-1.5 rounded-xl border border-[#dfcebe] bg-white text-[#332219] font-bold disabled:opacity-40 hover:bg-[#faebd7] flex items-center space-x-1 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <span className="tabular-nums font-extrabold text-[#7c4e2f] px-2.5 py-1 rounded-lg bg-[#faebd7]/60">
                      {opnamePage} / {opnameTotalPages}
                    </span>

                    <button
                      onClick={() => setOpnamePage((prev) => Math.min(opnameTotalPages, prev + 1))}
                      disabled={opnamePage >= opnameTotalPages}
                      className="px-3 py-1.5 rounded-xl border border-[#dfcebe] bg-white text-[#332219] font-bold disabled:opacity-40 hover:bg-[#faebd7] flex items-center space-x-1 transition-colors"
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

      </div>
    </div>
  );
};
