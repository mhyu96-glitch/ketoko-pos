import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Tag, 
  Percent, 
  Check, 
  UserPlus, 
  X 
} from 'lucide-react';
import type { CartItem } from '../types';
import { formatRupiah } from '../services/escposService';

interface CartViewProps {
  items: CartItem[];
  memberId?: string;
  setMemberId?: React.Dispatch<React.SetStateAction<string>> | ((id: string) => void);
  taxEnabled?: boolean;
  setTaxEnabled?: React.Dispatch<React.SetStateAction<boolean>> | ((enabled: boolean) => void);
  taxRate?: number;
  onTaxRateChange?: (rate: number) => void;
  onUpdateQty: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onCloseMobileCart?: () => void;
  subtotal: number;
  wholesaleSavings: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  totalItemCount: number;
}

export const CartView: React.FC<CartViewProps> = ({
  items,
  memberId: externalMemberId,
  setMemberId: externalSetMemberId,
  taxEnabled: externalTaxEnabled,
  setTaxEnabled: externalSetTaxEnabled,
  taxRate = 11,
  onTaxRateChange,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onCheckout,
  onCloseMobileCart,
  subtotal,
  wholesaleSavings,
  discountAmount,
  taxAmount,
  grandTotal,
  totalItemCount
}) => {
  const [internalMemberId, setInternalMemberId] = useState('');
  const [internalTaxEnabled, setInternalTaxEnabled] = useState(false);

  const memberId = externalMemberId !== undefined ? externalMemberId : internalMemberId;
  const setMemberId = externalSetMemberId || setInternalMemberId;

  const taxEnabled = externalTaxEnabled !== undefined ? externalTaxEnabled : internalTaxEnabled;
  const setTaxEnabled = externalSetTaxEnabled || setInternalTaxEnabled;

  const handleEditTax = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onTaxRateChange) return;
    const input = window.prompt(`Masukkan tarif pajak PPN (%) [saat ini: ${taxRate}%]:`, String(taxRate));
    if (input !== null) {
      const parsed = parseFloat(input);
      if (!isNaN(parsed) && parsed >= 0) {
        onTaxRateChange(parsed);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-[#e5d0be] shadow-xs overflow-hidden">
      
      {/* Cart Header - Coklat Susu Latte Header */}
      <div className="p-3.5 sm:p-4 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-[#83532e] text-white border border-[#a6744c]">
          </div>
          <div>
            <h2 className="font-extrabold text-white text-sm sm:text-base leading-tight">Keranjang Kasir</h2>
            <p className="text-[11px] text-[#fcefe3]">{totalItemCount} barang dalam nota</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {items.length > 0 && (
            <button
              onClick={onClearCart}
              title="Kosongkan keranjang"
              className="p-1.5 rounded-lg text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {onCloseMobileCart && (
            <button
              onClick={onCloseMobileCart}
              className="p-1.5 rounded-lg text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0 scrollbar-thin bg-[#fcf9f5]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[#8a6b53]">
            <div className="w-12 h-12 rounded-2xl bg-[#f5ebe0] text-[#96633b] flex items-center justify-center mb-2">
              <ShoppingBag className="w-6 h-6 opacity-75" />
            </div>
            <p className="text-xs font-bold text-[#5c3c26]">Keranjang masih kosong</p>
            <p className="text-[11px] text-[#8a6b53] mt-0.5 text-center max-w-[190px]">
              Klik tombol (+) pada produk untuk memasukkannya ke nota kasir.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isWholesale = item.is_wholesale;

            return (
              <div
                key={item.product_id}
                className="p-2.5 rounded-2xl border border-[#e5d0be] bg-white shadow-2xs hover:border-[#b8957c] transition-colors space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-xs text-[#3d2617] leading-tight">
                      {item.product_name}
                    </h3>
                    <div className="flex items-center space-x-1 mt-0.5">
                      <span className="font-mono text-[11px] text-[#8a6b53]">
                        {formatRupiah(item.price_applied)}
                      </span>
                      {isWholesale && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#faebd7] text-[#96633b] flex items-center border border-[#eed7c4]">
                          <Tag className="w-2.5 h-2.5 mr-0.5" /> Grosir
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-mono font-bold text-xs text-[#3d2617] whitespace-nowrap">
                    {formatRupiah(item.subtotal_item)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-[#f2e5d8]">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onUpdateQty(item.product_id, item.qty - 1)}
                      className="w-6 h-6 rounded-lg bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-xs text-[#3d2617]">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(item.product_id, item.qty + 1)}
                      className="w-6 h-6 rounded-lg bg-[#96633b] hover:bg-[#83532e] text-white flex items-center justify-center transition-colors shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => onRemoveItem(item.product_id)}
                    className="p-1 text-[#8a6b53] hover:text-rose-600 transition-colors"
                    title="Hapus item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Summary & Checkout Actions */}
      <div className="p-3.5 border-t border-[#e5d0be] bg-[#fdfaf7] space-y-2.5 shrink-0">
        {/* Member Input & Tax Switch */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="relative">
            <input
              type="text"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="ID Member (5%)..."
              className="w-full pl-7 pr-2 py-1.5 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] focus:border-[#96633b] text-xs placeholder:text-[#8a6b53] shadow-xs"
            />
            <UserPlus className="w-3.5 h-3.5 absolute left-2 top-2 text-[#8a6b53]" />
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setTaxEnabled(!taxEnabled)}
              className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-colors shadow-xs ${
                taxEnabled
                  ? 'bg-[#edf5ee] text-[#166534] border-[#cce2cf] font-semibold'
                  : 'bg-white text-[#5c3c26] border-[#ddc3aa]'
              }`}
            >
              <span>PPN ({taxRate}%)</span>
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${taxEnabled ? 'bg-[#15803d] text-white' : 'bg-[#e5d0be]'}`}>
                {taxEnabled && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </button>
            {onTaxRateChange && (
              <button
                type="button"
                onClick={handleEditTax}
                title="Ubah persentase pajak PPN"
                className="p-1.5 rounded-xl border border-[#ddc3aa] bg-white hover:bg-[#faebd7] text-[#7c4e2f] text-xs font-bold"
              >
                ✏️
              </button>
            )}
          </div>
        </div>

        {/* Calculation Lines */}
        <div className="space-y-1 text-xs text-[#5c3c26] pt-0.5">
          <div className="flex justify-between">
            <span className="text-[#8a6b53]">Subtotal</span>
            <span className="font-mono font-semibold">{formatRupiah(subtotal)}</span>
          </div>

          {wholesaleSavings > 0 && (
            <div className="flex justify-between text-[#96633b] font-medium">
              <span className="flex items-center">
                <Tag className="w-3 h-3 mr-1" /> Hemat Grosir
              </span>
              <span className="font-mono font-bold">-{formatRupiah(wholesaleSavings)}</span>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex justify-between text-[#15803d] font-medium">
              <span className="flex items-center">
                <Percent className="w-3 h-3 mr-1" /> Diskon Member (5%)
              </span>
              <span className="font-mono font-bold">-{formatRupiah(discountAmount)}</span>
            </div>
          )}

          {taxAmount > 0 && (
            <div className="flex justify-between text-[#8a6b53]">
              <span>PPN ({taxRate}%)</span>
              <span className="font-mono">{formatRupiah(taxAmount)}</span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-1.5 border-t border-[#e5d0be] text-[#3d2617]">
            <span className="font-bold text-xs sm:text-sm">Grand Total</span>
            <span className="font-mono font-black text-lg sm:text-xl text-[#96633b]">
              {formatRupiah(grandTotal)}
            </span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full py-2.5 px-4 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
        >
          <CreditCard className="w-4 h-4 text-white" />
          <span>Bayar Kasir ({formatRupiah(grandTotal)})</span>
        </button>
      </div>

    </div>
  );
};
