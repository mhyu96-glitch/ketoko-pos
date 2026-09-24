import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Search, MapPin, PlusCircle, ArrowLeft, ShoppingBag, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah } from '../services/escposService';

interface InventoryViewProps {
  products: Product[];
  onGoToPOS: () => void;
  onOpenRestockModal: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = React.memo(({
  products,
  onGoToPOS,
  onOpenRestockModal
}) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterCategory]);

  const categories = useMemo(() => {
    const catSet = new Set<string>();
    const len = products.length;
    for (let i = 0; i < len; i++) {
      if (products[i].category) catSet.add(products[i].category);
    }
    return ['ALL', ...Array.from(catSet).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q && filterCategory === 'ALL') return products;

    return products.filter((p) => {
      const matchCat = filterCategory === 'ALL' || p.category === filterCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.rack_location.toLowerCase().includes(q)
      );
    });
  }, [products, debouncedSearch, filterCategory]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pageItems = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#f6f0ea] space-y-4">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-[#e4d5c7] shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-[#332219] text-base">Manajemen Persediaan & Kartu Stok</h2>
            <p className="text-xs text-[#856b59]">Tinjau sisa stok fisik, ambang batas minimum, dan lokasi rak gudang</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={onOpenRestockModal}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Penerimaan Stok (Restock)</span>
          </button>

          <button
            onClick={onGoToPOS}
            className="px-3.5 py-2 bg-[#f5ece3] hover:bg-[#ebdccf] text-[#543c2e] rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-[#dfcebe] transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Kasir</span>
            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {/* Filter & Search Strip */}
      <div className="bg-white p-4 rounded-3xl border border-[#e4d5c7] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#856b59] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU, nama produk, rak..."
            className="w-full pl-9 pr-4 py-2 bg-white text-[#332219] rounded-xl border border-[#dfcebe] text-xs focus:bg-white focus:border-[#7c4e2f]"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === c
                  ? 'bg-[#7c4e2f] text-white font-semibold shadow-xs'
                  : 'bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf] border border-[#dfcebe]'
              }`}
            >
              {c === 'ALL' ? 'Semua Kategori' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#543c2e]">
            <thead className="bg-[#f1e5d8] text-[#634837] font-bold border-b border-[#dfcebe]">
              <tr>
                <th className="px-4 py-3">Kode SKU & Barcode</th>
                <th className="px-4 py-3">Nama Produk</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Lokasi Rak</th>
                <th className="px-4 py-3 text-right">Harga Beli</th>
                <th className="px-4 py-3 text-right">Harga Jual (Eceran)</th>
                <th className="px-4 py-3 text-center">Sisa Stok</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e4d7]">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#856b59]">
                    Tidak ada data produk yang sesuai.
                  </td>
                </tr>
              ) : (
                pageItems.map((prod) => {
                  const isLow = prod.stock <= prod.min_stock_alert;
                  return (
                    <tr key={prod.id} className="hover:bg-[#fcf8f4] transition-colors">
                      <td className="px-4 py-3 font-mono">
                        <div className="font-bold text-[#332219]">{prod.id}</div>
                        <div className="text-[11px] text-[#856b59]">{prod.barcode}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#332219]">
                        {prod.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#f5ece3] text-[#543c2e] border border-[#dfcebe] text-[11px]">
                          {prod.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#543c2e]">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-[#7c4e2f]" />
                          <span>{prod.rack_location}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#856b59]">
                        {formatRupiah(prod.buy_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#7c4e2f]">
                        {formatRupiah(prod.retail_price)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-sm">
                        <span className={isLow ? 'text-rose-700' : 'text-[#332219]'}>
                          {prod.stock} {prod.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fbeeed] text-rose-800 border border-[#f4cfcf]">
                            ⚠️ Stok Tipis (&le;{prod.min_stock_alert})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#edf5ee] text-[#166534] border border-[#cce2cf]">
                            Normal
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

        {/* Pagination Bar */}
        <div className="p-3 bg-[#fdfaf7] border-t border-[#dfcebe] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs text-[#856b59]">
            Menampilkan <b className="text-[#332219]">{filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</b> -{' '}
            <b className="text-[#332219]">{Math.min(currentPage * pageSize, filtered.length)}</b> dari{' '}
            <b className="text-[#332219]">{filtered.length.toLocaleString('id-ID')}</b> total produk
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="Halaman Pertama"
              className="p-1.5 rounded-lg bg-white border border-[#dfcebe] text-[#543c2e] hover:bg-[#f5ece3] disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Halaman Sebelumnya"
              className="p-1.5 rounded-lg bg-white border border-[#dfcebe] text-[#543c2e] hover:bg-[#f5ece3] disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 text-xs font-bold text-[#6d4327] bg-[#faebd7] border border-[#ecdac5] rounded-lg">
              Halaman {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              title="Halaman Selanjutnya"
              className="p-1.5 rounded-lg bg-white border border-[#dfcebe] text-[#543c2e] hover:bg-[#f5ece3] disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Halaman Terakhir"
              className="p-1.5 rounded-lg bg-white border border-[#dfcebe] text-[#543c2e] hover:bg-[#f5ece3] disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
});
