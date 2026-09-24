import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Layers, 
  Tag, 
  Sparkles, 
  ArrowUpDown,
  Check,
  ChevronDown
} from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah } from '../services/escposService';

interface ProductCatalogProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  searchQuery?: string;
  isTouchscreenMode?: boolean;
}

type SortOption = 'popularity' | 'price_asc' | 'price_desc' | 'name';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'popularity', label: 'Terpopuler' },
  { value: 'price_asc', label: 'Harga: Termurah' },
  { value: 'price_desc', label: 'Harga: Tertinggi' },
  { value: 'name', label: 'Nama A - Z' }
];

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  onAddToCart,
  searchQuery = '',
  isTouchscreenMode = true
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterOfferOnly, setFilterOfferOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState<number>(48);
  const sortRef = useRef<HTMLDivElement>(null);

  // Debounce search query so we don't filter 24K items on every keystroke
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setDisplayLimit(48);
  }, [selectedCategory, debouncedQuery, filterOfferOnly, sortBy]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    let list = products.filter((p) => {
      const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.rack_location.toLowerCase().includes(q);
      const matchOffer = !filterOfferOnly || p.wholesale_price < p.retail_price;
      return matchCategory && matchQuery && matchOffer;
    });

    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => a.retail_price - b.retail_price);
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => b.retail_price - a.retail_price);
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [products, selectedCategory, debouncedQuery, filterOfferOnly, sortBy]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  const handleLoadMore = () => {
    setDisplayLimit((prev) => Math.min(prev + 48, filteredProducts.length));
  };

  const currentSortLabel = sortOptions.find(o => o.value === sortBy)?.label || 'Terpopuler';

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      
      {/* 1. Header & Category Filter Bar (Coklat Susu Theme) */}
      <div className="flex flex-col gap-1.5 shrink-0 bg-white p-2 sm:p-2.5 rounded-2xl border border-[#e4d5c7] shadow-xs">
        
        {/* Top Row: Title, Items Count, Touchscreen Switch, Promo Filter, and Sort */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs sm:text-sm font-extrabold text-[#332219] tracking-tight">
              Katalog Produk
            </h2>
            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#faebd7] text-[#7c4e2f] rounded-full border border-[#ecdac5]">
              {filteredProducts.length} item
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Promo Grosir Toggle */}
            <button
              type="button"
              onClick={() => setFilterOfferOnly(!filterOfferOnly)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                filterOfferOnly
                  ? 'bg-[#faebd7] text-[#7c4e2f] border-[#e8d5c0] ring-1 ring-[#8c5e3c]/30 shadow-xs'
                  : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
              }`}
            >
              <Tag className="w-3 h-3 text-[#8c5e3c]" />
              <span>Promo</span>
            </button>

            {/* Custom Sort Popover */}
            <div ref={sortRef} className="relative">
              <button
                type="button"
                onClick={() => setIsSortOpen(!isSortOpen)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all border shadow-xs ${
                  isSortOpen
                    ? 'bg-[#f5ece3] text-[#332219] border-[#dfcebe] ring-1 ring-[#7c4e2f]/20'
                    : 'bg-white hover:bg-[#fbf7f2] text-[#543c2e] border-[#e4d5c7]'
                }`}
              >
                <ArrowUpDown className="w-3 h-3 text-[#8c7766]" />
                <span>{currentSortLabel}</span>
                <ChevronDown className={`w-3 h-3 text-[#a08573] transition-transform duration-150 ${isSortOpen ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
              </button>

              {isSortOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e4d5c7] rounded-2xl shadow-xl py-1 z-50 animate-fadeIn divide-y divide-[#f0e4d7]">
                  {sortOptions.map((opt) => {
                    const isSelected = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.value);
                          setIsSortOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#faebd7] text-[#6d4327] font-bold'
                            : 'text-[#96633b] hover:bg-[#fbf7f2] font-medium'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#7c4e2f] stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Category Filter Chips Bar (Coklat Susu) */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 border active:scale-95 ${
                  isSelected
                    ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                    : 'bg-[#fbf7f2] text-[#543c2e] hover:bg-[#f5ece3] hover:text-[#332219] border-[#e4d5c7]'
                }`}
              >
                {cat === 'ALL' ? 'Semua' : cat}
              </button>
            );
          })}
        </div>

      </div>

      {/* 2. Product Cards Grid (Fluid 4 to 6 columns with Coklat Susu Styling) */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-[#e4d5c7] text-[#a08573]">
          <Layers className="w-8 h-8 mb-1.5 opacity-30 text-[#7c4e2f]" />
          <p className="text-xs font-semibold text-[#543c2e]">Tidak ada produk yang cocok</p>
          <p className="text-[10px] text-[#a08573] mt-0.5">Coba ubah kata kunci pencarian atau kategori filter.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-1 scrollbar-thin scrollbar-thumb-[#caa992] scrollbar-track-[#eee2d5] hover:scrollbar-thumb-[#a8836a] rounded-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5">
            {visibleProducts.map((prod) => {
              const isOutOfStock = prod.stock <= 0;

              return (
                <div
                  key={prod.id}
                  onClick={() => !isOutOfStock && onAddToCart(prod)}
                  className={`group relative bg-white rounded-2xl p-2.5 sm:p-3 border border-[#e4d5c7] shadow-2xs hover:shadow-md hover:border-[#b8957c] transition-all flex flex-col justify-between cursor-pointer active:scale-95 ${
                    isOutOfStock ? 'opacity-60 cursor-not-allowed bg-[#fcf8f4]' : ''
                  }`}
                >
                  {/* Top: SKU, Category & Stock Badge */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5 min-h-[18px]">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#faebd7] text-[#7c4e2f] border border-[#ecdac5] truncate max-w-[110px]">
                        {prod.id}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                        isOutOfStock 
                          ? 'bg-rose-100 text-rose-800' 
                          : prod.stock <= prod.min_stock_alert 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-[#edf5ee] text-[#166534]'
                      }`}>
                        {isOutOfStock ? 'Habis' : `${prod.stock} ${prod.unit}`}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h3 className="text-xs font-extrabold text-[#332219] line-clamp-2 leading-snug group-hover:text-[#7c4e2f] transition-colors min-h-[34px]">
                      {prod.name}
                    </h3>

                    {/* Barcode & Rack Subtitle */}
                    <div className="flex items-center justify-between text-[10px] text-[#856b59] mt-1">
                      <span className="font-mono text-[9px] truncate max-w-[90px]">{prod.barcode}</span>
                      <span className="bg-[#f5ece3] px-1 rounded text-[9px] text-[#543c2e] font-mono">{prod.rack_location}</span>
                    </div>
                  </div>

                  {/* Pricing & Add Button Footer */}
                  <div className="mt-2.5 pt-2 border-t border-[#f0e4d7] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-[#7c4e2f] font-mono">
                        {formatRupiah(prod.retail_price)}
                      </div>

                      {prod.wholesale_price < prod.retail_price && (
                        <div className="text-[8px] text-[#96633b] font-semibold flex items-center mt-0.5">
                          <Sparkles className="w-2 h-2 mr-0.5 text-[#96633b]" />
                          Grosir: {formatRupiah(prod.wholesale_price)} (&ge;{prod.min_wholesale_qty})
                        </div>
                      )}
                    </div>

                    {/* Circular Add Button */}
                    <button
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOutOfStock) onAddToCart(prod);
                      }}
                      title="Tambah ke nota"
                      className={`bg-[#96633b] hover:bg-[#83532e] disabled:opacity-30 text-white rounded-full flex items-center justify-center shadow-xs hover:shadow-md active:scale-90 transition-all shrink-0 ml-1 ${
                        isTouchscreenMode ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-6 h-6 sm:w-7 sm:h-7'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Load More Button & Footer Info */}
          {visibleProducts.length < filteredProducts.length && (
            <div className="py-4 flex flex-col items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-5 py-2 bg-[#f5ece3] hover:bg-[#ebdccf] text-[#6d4327] border border-[#dfcebe] rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all"
              >
                Muat Lebih Banyak ({filteredProducts.length - visibleProducts.length} lagi tersisa)
              </button>
              <p className="text-[10px] text-[#856b59]">
                Menampilkan {visibleProducts.length} dari {filteredProducts.length.toLocaleString('id-ID')} produk
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
