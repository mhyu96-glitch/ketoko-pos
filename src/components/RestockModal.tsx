import React, { useState, useMemo } from 'react';
import { X, PlusCircle, CheckCircle, ArrowDownRight, Search, Package } from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah } from '../services/escposService';
import { syncService } from '../services/syncService';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRestockComplete?: () => Promise<void> | void;
  onRestockSuccess?: () => Promise<void> | void;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  products,
  onRestockComplete,
  onRestockSuccess
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [incomingQty, setIncomingQty] = useState<number>(10);
  const [notes, setNotes] = useState('Penerimaan dari Gudang / Distributor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  // Fast filtered autocomplete results capped at top 8
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    const results: Product[] = [];
    const len = products.length;
    for (let i = 0; i < len; i++) {
      const p = products[i];
      if (
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.id.toLowerCase().includes(q)
      ) {
        results.push(p);
        if (results.length >= 8) break;
      }
    }
    return results;
  }, [products, searchQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct || incomingQty <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newStock = currentProduct.stock + incomingQty;
      const updatedProduct: Product = {
        ...currentProduct,
        stock: newStock,
        updated_at: new Date().toISOString()
      };
      await syncService.syncProductChange(updatedProduct);

      setSuccessMessage(`Stok ${currentProduct.name} berhasil ditambah +${incomingQty} ${currentProduct.unit}!`);
      if (onRestockComplete) await onRestockComplete();
      if (onRestockSuccess) await onRestockSuccess();

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
        setIncomingQty(10);
      }, 1000);
    } catch (err: any) {
      alert('Gagal menambah stok: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Penerimaan Barang Masuk (Restock)</h3>
              <p className="text-xs text-[#fcefe3]">Tambah stok fisik barang langsung ke database lokal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs bg-[#fcf9f5]">
          
          {/* Fast Autocomplete Search Product */}
          <div className="space-y-1.5 relative">
            <label className="text-[#5c3c26] font-bold block">Pilih / Cari Produk yang Masuk:</label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#8a6b53] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ketik nama produk, barcode, atau SKU..."
                value={searchQuery}
                onFocus={() => setIsSearching(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearching(true);
                }}
                className="w-full pl-9 pr-4 py-2.5 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b] shadow-2xs font-medium"
              />
            </div>

            {/* Dropdown Suggestions */}
            {isSearching && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-2xl shadow-xl z-20 max-h-56 overflow-y-auto p-1.5 space-y-1">
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setSearchQuery(p.name);
                      setIsSearching(false);
                    }}
                    className="p-2.5 rounded-xl hover:bg-[#fcf5ed] cursor-pointer flex items-center justify-between transition-colors text-xs border border-transparent hover:border-[#eed7c4]"
                  >
                    <div>
                      <div className="font-bold text-[#3d2617]">{p.name}</div>
                      <div className="text-[10px] text-[#8a6b53] font-mono flex items-center space-x-2 mt-0.5">
                        <span>{p.barcode || p.id}</span>
                        <span>• Rak: {p.rack_location}</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-[#7c4e2f] bg-[#faebd7] px-2 py-0.5 rounded-lg text-[11px]">
                      Stok: {p.stock} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Stock Preview Card */}
          {currentProduct && (
            <div className="p-3.5 bg-white rounded-2xl border border-[#e5d0be] space-y-2 shadow-xs">
              <div className="flex items-center space-x-2 pb-2 border-b border-[#f2e5d8]">
                <Package className="w-4 h-4 text-[#7c4e2f]" />
                <span className="font-bold text-sm text-[#2a1a12]">{currentProduct.name}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[#8a6b53]">Stok Saat Ini:</span>
                <span className="font-mono font-bold text-sm text-[#3d2617]">
                  {currentProduct.stock} {currentProduct.unit}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[#8a6b53]">Harga Beli Master:</span>
                <span className="font-mono text-[#5c3c26] font-bold">{formatRupiah(currentProduct.buy_price)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[#8a6b53]">Lokasi Rak Gudang:</span>
                <span className="font-mono text-[#96633b] font-bold">{currentProduct.rack_location}</span>
              </div>
            </div>
          )}

          {/* Input Incoming Quantity */}
          <div>
            <label className="text-[#5c3c26] font-semibold mb-1.5 block">
              Jumlah Barang Masuk ({currentProduct?.unit || 'Pcs'})
            </label>
            <input
              type="number"
              min="1"
              value={incomingQty}
              onChange={(e) => setIncomingQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2.5 bg-white text-[#3d2617] font-mono font-bold text-base rounded-xl border border-[#ddc3aa] focus:bg-white focus:border-[#96633b]"
              required
            />
          </div>

          {/* Stock Simulation */}
          {currentProduct && (
            <div className="p-3 bg-[#edf5ee] rounded-2xl border border-[#cce2cf] flex items-center justify-between text-xs">
              <span className="text-[#166534] font-medium flex items-center">
                <ArrowDownRight className="w-4 h-4 mr-1 text-[#166534]" />
                Estimasi Stok Setelah Restock:
              </span>
              <span className="font-mono font-bold text-sm text-[#166534]">
                {currentProduct.stock + incomingQty} {currentProduct.unit}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[#5c3c26] font-semibold mb-1 block">Catatan Penerimaan / No. Dokumen</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b]"
            />
          </div>

          {successMessage && (
            <div className="p-3 rounded-xl bg-[#edf5ee] border border-[#cce2cf] text-[#166534] text-xs text-center font-semibold flex items-center justify-center space-x-1.5 animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-[#166534]" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || incomingQty <= 0}
              className="w-full py-3 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Memperbarui Database...' : 'Simpan Penerimaan Stok'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
