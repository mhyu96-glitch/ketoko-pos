import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Tag, 
  Printer, 
  Search, 
  Trash2, 
  Sliders, 
  Layers
} from 'lucide-react';
import type { Product, StoreProfile } from '../types';
import { db } from '../db';
import { generateBarcodeSvg } from '../utils/barcodeGenerator';

interface LabelItem {
  product: Product;
  quantity: number;
}

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<LabelItem[]>([]);
  const [labelType, setLabelType] = useState<'product_sticker' | 'shelf_tag'>('product_sticker');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [storeProfile] = useState<StoreProfile>(() => {
    const saved = localStorage.getItem('ketoko_store_profile');
    return saved ? JSON.parse(saved) : { name: 'KETOKO POS', branch_name: 'Cabang Samarinda' };
  });

  // Debounced product search from IndexedDB
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const q = searchQuery.toLowerCase().trim();
      const results = await db.products
        .filter(p => 
          p.name.toLowerCase().includes(q) || 
          p.barcode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        )
        .limit(8)
        .toArray();
      setSearchResults(results);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddProduct = (prod: Product) => {
    setSelectedItems(prev => {
      const exists = prev.find(item => item.product.id === prod.id);
      if (exists) {
        return prev.map(item => 
          item.product.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems(prev => prev.filter(i => i.product.id !== productId));
    } else {
      setSelectedItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
    }
  };

  const handleClearAll = () => {
    setSelectedItems([]);
  };

  // Flatten selected items by quantity for the print layout
  const flattenedLabels = useMemo(() => {
    const list: Product[] = [];
    selectedItems.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        list.push(item.product);
      }
    });
    return list;
  }, [selectedItems]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c] shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight text-white">Cetak Label Barcode & Rak Harga</h3>
              <p className="text-xs text-[#fcefe3] font-medium">Buat stiker barcode produk dan label harga rak display</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs bg-[#fcf9f5]">
          
          {/* Left Panel: Search & Controls (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Search Product Box */}
            <div className="bg-white p-4 rounded-3xl border border-[#e5d0be] shadow-xs space-y-3">
              <label className="block text-xs font-bold text-[#5c3c26]">Cari Produk untuk Dicetak:</label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#8a6b53] absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama atau barcode produk..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#fdfaf7] border border-[#ddc3aa] text-xs font-medium text-[#3d2617] focus:outline-none focus:ring-2 focus:ring-[#96633b]"
                />
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#ddc3aa] shadow-md p-1.5 space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleAddProduct(p)}
                      className="w-full p-2 text-left hover:bg-[#fbf7f2] rounded-xl flex items-center justify-between group transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-[#3d2617] truncate">{p.name}</div>
                        <div className="text-[10px] text-[#8a6b53] font-mono">{p.barcode} • {p.category}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-[#96633b]">Rp {p.retail_price.toLocaleString('id-ID')}</div>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold">+ Pilih</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Label Layout & Settings */}
            <div className="bg-white p-4 rounded-3xl border border-[#e5d0be] shadow-xs space-y-3">
              <div className="flex items-center space-x-2 border-b border-[#f2e5d8] pb-2">
                <Sliders className="w-4 h-4 text-[#96633b]" />
                <h4 className="font-extrabold text-xs text-[#3d2617]">Pilihan Tipe & Format Label</h4>
              </div>

              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLabelType('product_sticker')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    labelType === 'product_sticker'
                      ? 'bg-[#faebd7] border-[#96633b] text-[#7c4e2f] shadow-xs'
                      : 'bg-[#fdfaf7] border-[#eed7c4] text-[#5c3c26]'
                  }`}
                >
                  <div className="font-bold text-xs">Stiker Barcode</div>
                  <div className="text-[10px] text-[#8a6b53] mt-0.5">Stiker kemasan (33x15mm / 40x30mm)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLabelType('shelf_tag')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    labelType === 'shelf_tag'
                      ? 'bg-[#faebd7] border-[#96633b] text-[#7c4e2f] shadow-xs'
                      : 'bg-[#fdfaf7] border-[#eed7c4] text-[#5c3c26]'
                  }`}
                >
                  <div className="font-bold text-xs">Label Rak Toko</div>
                  <div className="text-[10px] text-[#8a6b53] mt-0.5">Price Tag display rak (60x35mm)</div>
                </button>
              </div>

              {/* Options Checkboxes */}
              <div className="space-y-2 pt-1 text-xs text-[#5c3c26]">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded text-[#96633b] focus:ring-[#96633b]"
                  />
                  <span>Tampilkan Nama Toko ({storeProfile.name})</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-[#96633b] focus:ring-[#96633b]"
                  />
                  <span>Tampilkan Harga Jual (Rp)</span>
                </label>
              </div>
            </div>

            {/* Selected Queue List */}
            <div className="bg-white p-4 rounded-3xl border border-[#e5d0be] shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#f2e5d8] pb-2">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-[#96633b]" />
                  <h4 className="font-extrabold text-xs text-[#3d2617]">Daftar Cetak ({selectedItems.length} Produk • {flattenedLabels.length} Label)</h4>
                </div>
                {selectedItems.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] text-rose-600 hover:underline font-bold"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {selectedItems.length === 0 ? (
                <div className="text-center py-6 text-[#8a6b53]">
                  <Tag className="w-8 h-8 mx-auto text-[#ddc3aa] mb-1.5 opacity-60" />
                  <p>Belum ada produk yang dipilih.</p>
                  <p className="text-[10px]">Cari produk di atas untuk menambahkan label.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedItems.map(item => (
                    <div key={item.product.id} className="p-2.5 bg-[#fbf7f2] rounded-2xl border border-[#eed7c4] flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-[#3d2617] truncate text-xs">{item.product.name}</div>
                        <div className="text-[10px] text-[#8a6b53] font-mono">Rp {item.product.retail_price.toLocaleString('id-ID')}</div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleUpdateQty(item.product.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-[#ddc3aa] font-bold text-xs flex items-center justify-center hover:bg-[#faebd7]"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-xs">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQty(item.product.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-[#ddc3aa] font-bold text-xs flex items-center justify-center hover:bg-[#faebd7]"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => handleUpdateQty(item.product.id, 0)}
                          className="p-1 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Live Print Preview (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            
            <div className="bg-white p-4 rounded-3xl border border-[#e5d0be] shadow-xs flex-1 flex flex-col">
              <div className="flex items-center justify-between border-b border-[#f2e5d8] pb-3 mb-3">
                <div>
                  <h4 className="font-extrabold text-xs text-[#3d2617]">Pratinjau Lembar Cetak (Live Preview)</h4>
                  <p className="text-[10px] text-[#8a6b53]">Tata letak otomatis siap cetak ke printer label atau printer standar</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-xs text-[#96633b]">{flattenedLabels.length} Lembar Label</span>
                </div>
              </div>

              {/* Printable Canvas Container */}
              <div className="flex-1 bg-[#fbf7f2] p-4 rounded-2xl border border-[#eed7c4] overflow-y-auto max-h-[480px]">
                {flattenedLabels.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-16 text-[#8a6b53]">
                    <Printer className="w-12 h-12 text-[#ddc3aa] mb-2 opacity-50" />
                    <p className="font-bold">Pratinjau Masih Kosong</p>
                    <p className="text-[10px]">Silakan pilih produk dari panel sebelah kiri.</p>
                  </div>
                ) : (
                  <div className={`grid gap-3 ${
                    labelType === 'product_sticker'
                      ? 'grid-cols-2 sm:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}>
                    {flattenedLabels.map((prod, idx) => (
                      <div
                        key={`${prod.id}-${idx}`}
                        className={`bg-white rounded-xl border border-stone-800 p-2.5 flex flex-col justify-between shadow-2xs ${
                          labelType === 'product_sticker' ? 'min-h-[110px]' : 'min-h-[140px] border-2'
                        }`}
                      >
                        {/* Header Store / Category */}
                        {showStoreName && (
                          <div className="text-center font-extrabold text-[9px] uppercase tracking-wider text-stone-800 border-b border-dashed border-stone-300 pb-0.5 mb-1 truncate">
                            {storeProfile.name}
                          </div>
                        )}

                        {/* Product Title */}
                        <div className="text-center font-bold text-[11px] leading-tight text-stone-900 line-clamp-2 mb-1">
                          {prod.name}
                        </div>

                        {/* Barcode SVG */}
                        <div className="w-full flex justify-center my-0.5 px-1">
                          <div 
                            className="w-full max-h-10 flex justify-center"
                            dangerouslySetInnerHTML={{ __html: generateBarcodeSvg(prod.barcode, labelType === 'product_sticker' ? 30 : 38, true) }} 
                          />
                        </div>

                        {/* Price Tag */}
                        {showPrice && (
                          <div className={`text-center font-mono font-black text-stone-950 mt-1 ${
                            labelType === 'shelf_tag' ? 'text-base bg-stone-100 py-1 rounded-md' : 'text-xs'
                          }`}>
                            Rp {prod.retail_price.toLocaleString('id-ID')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Print Action Bar */}
              <div className="pt-4 flex items-center justify-between">
                <div className="text-[11px] text-[#8a6b53]">
                  💡 Gunakan kertas stiker label atau kertas HVS biasa lalu potong.
                </div>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={flattenedLabels.length === 0}
                  className="px-6 py-3 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white font-black text-xs rounded-2xl shadow-lg shadow-[#96633b]/20 flex items-center space-x-2 transition-all active:scale-[0.98]"
                >
                  <Printer className="w-4 h-4 text-amber-200" />
                  <span>Cetak {flattenedLabels.length} Label (Print)</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

