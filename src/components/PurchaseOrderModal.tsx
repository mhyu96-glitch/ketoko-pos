import React, { useState, useMemo } from 'react';
import { X, FileSpreadsheet, Trash2, CheckCircle2, Search, Plus } from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah } from '../services/escposService';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

interface POItem {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  estimatedCost: number;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  products
}) => {
  const [supplierName, setSupplierName] = useState('PT. Sumber Makmur Distribusi');
  const [orderItems, setOrderItems] = useState<POItem[]>([
    {
      productId: products[0]?.id || '1',
      name: products[0]?.name || 'Minyak Goreng Sania 2L',
      qty: 24,
      unit: products[0]?.unit || 'Pcs',
      estimatedCost: products[0]?.buy_price || 30000
    },
    {
      productId: products[1]?.id || '2',
      name: products[1]?.name || 'Beras Ramos 5kg',
      qty: 10,
      unit: products[1]?.unit || 'Pcs',
      estimatedCost: products[1]?.buy_price || 62000
    }
  ]);

  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [orderQty, setOrderQty] = useState<number>(12);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Fast autocomplete search results capped at top 8
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
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
  }, [products, searchQuery]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    setOrderItems([
      ...orderItems,
      {
        productId: prod.id,
        name: prod.name,
        qty: orderQty,
        unit: prod.unit,
        estimatedCost: prod.buy_price
      }
    ]);
    setSelectedProductId('');
    setSearchQuery('');
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const totalEstimate = orderItems.reduce((acc, it) => acc + it.qty * it.estimatedCost, 0);

  const handleSavePO = () => {
    setSuccessNotice(`Draft PO (${orderItems.length} item) berhasil dibuat dan siap dikirim ke supplier!`);
    setTimeout(() => {
      setSuccessNotice(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Pesanan Pembelian (Purchase Order)</h3>
              <p className="text-xs text-[#fcefe3]">Buat pesanan pengadaan barang ke supplier / distributor</p>
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
        <div className="p-5 overflow-y-auto space-y-4 text-xs bg-[#fcf9f5]">
          
          {/* Supplier Info */}
          <div>
            <label className="text-[#5c3c26] font-semibold mb-1 block">Nama Supplier / Distributor</label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] focus:bg-white focus:border-[#96633b]"
            />
          </div>

          {/* Add Item Row */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#e5d0be] space-y-2 shadow-xs">
            <span className="font-bold text-[#3d2617] block">Tambah Item Pesanan:</span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              
              {/* Product Autocomplete */}
              <div className="flex-1 relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari produk / SKU / barcode..."
                    value={searchQuery}
                    onFocus={() => setIsSearching(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearching(true);
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b]"
                  />
                </div>

                {/* Dropdown suggestions */}
                {isSearching && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1 space-y-1">
                    {searchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setSearchQuery(`${p.name} (Stok: ${p.stock} ${p.unit})`);
                          setIsSearching(false);
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

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={orderQty}
                  onChange={(e) => setOrderQty(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono text-center text-xs font-bold"
                  placeholder="Qty"
                />

                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProductId}
                  className="px-4 py-2 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white font-bold rounded-xl transition-all shadow-xs shrink-0 flex items-center space-x-1 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>

            </div>
          </div>

          {/* PO Items Table */}
          <div className="border border-[#e5d0be] rounded-2xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f5ebe0] text-[#5c3c26] border-b border-[#e5d0be] font-bold">
                <tr>
                  <th className="p-2.5">Produk</th>
                  <th className="p-2.5 text-center">Jumlah</th>
                  <th className="p-2.5 text-right">Est. Harga Beli</th>
                  <th className="p-2.5 text-right">Subtotal Est.</th>
                  <th className="p-2.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2e5d8]">
                {orderItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#fcf9f5]">
                    <td className="p-2.5 font-semibold text-[#3d2617]">{item.name}</td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#5c3c26]">{item.qty} {item.unit}</td>
                    <td className="p-2.5 text-right font-mono text-[#8a6b53]">{formatRupiah(item.estimatedCost)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-[#96633b]">
                      {formatRupiah(item.qty * item.estimatedCost)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-[#8a6b53] hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Estimate Total */}
          <div className="p-3 bg-white rounded-2xl border border-[#e5d0be] flex items-center justify-between shadow-xs">
            <span className="font-semibold text-[#5c3c26]">Total Estimasi Pembelian:</span>
            <span className="font-mono font-black text-base text-[#96633b]">
              {formatRupiah(totalEstimate)}
            </span>
          </div>

          {successNotice && (
            <div className="p-3 rounded-xl bg-[#edf5ee] border border-[#cce2cf] text-[#166534] text-xs font-semibold flex items-center justify-center space-x-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-[#166534]" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSavePO}
              disabled={orderItems.length === 0}
              className="w-full py-3 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white font-bold rounded-xl shadow-xs transition-all"
            >
              Simpan & Cetak Purchase Order
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
