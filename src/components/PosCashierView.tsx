import React, { useState, useEffect, useMemo } from 'react';
import { 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  UserCheck, 
  Check, 
  Tag, 
  Percent, 
  Clock, 
  Printer, 
  Receipt, 
  Sparkles, 
  PauseCircle, 
  X, 
  Wallet, 
  QrCode, 
  Smartphone,
  Coins,
  Delete,
  ShoppingBag
} from 'lucide-react';
import type { CartItem, Product } from '../types';
import { formatRupiah } from '../services/escposService';
import { BarcodeScanner } from './BarcodeScanner';

interface HeldCart {
  id: string;
  timestamp: string;
  items: CartItem[];
  memberId: string;
  subtotal: number;
}

interface PosCashierViewProps {
  products: Product[];
  cartItems: CartItem[];
  memberId: string;
  setMemberId: (id: string) => void;
  taxEnabled: boolean;
  setTaxEnabled: (enabled: boolean) => void;
  taxRate?: number;
  onTaxRateChange?: (rate: number) => void;
  subtotal: number;
  wholesaleSavings: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  totalItemCount: number;
  onAddToCart: (product: Product, qty?: number) => void;
  onUpdateQty: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onBarcodeScan: (code: string) => Promise<{ found: boolean; product?: Product; latencyMs: number }>;
  onOpenRecentTrx: () => void;
  onDirectPayment: (method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER', cashGiven?: number) => void;
  isCatalogSeeding?: boolean;
  isTouchscreenMode?: boolean;
}

// Isolated Self-Updating Live Digital Clock (Prevents whole page re-render every second)
const LiveDigitalClock: React.FC = React.memo(() => {
  const [time, setTime] = useState(() => 
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="font-mono font-extrabold text-xs text-[#7c4e2f] bg-[#fcf5ed] px-2 py-0.5 rounded border border-[#dfcebe]">
      {time}
    </div>
  );
});

interface CartRowProps {
  item: CartItem;
  index: number;
  onUpdateQty: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
}

const CartRow = React.memo<CartRowProps>(({ item, index, onUpdateQty, onRemoveItem }) => {
  const isWholesale = item.is_wholesale;
  const isEven = index % 2 === 0;

  return (
    <tr className={`transition-colors group ${isEven ? 'bg-white' : 'bg-[#fcfaf7]'} hover:bg-[#f6eee4]`}>
      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-[#8a6b53] font-bold">
        {index + 1}
      </td>
      <td className="py-2.5 px-3">
        <div className="font-mono text-xs font-bold text-[#7c4e2f]">
          {item.barcode || item.product_id}
        </div>
        {item.barcode && item.barcode !== item.product_id && (
          <div className="font-mono text-[10px] text-[#8a6b53]">
            SKU: {item.product_id}
          </div>
        )}
      </td>
      <td className="py-2.5 px-3">
        <div className="font-bold text-xs text-[#2a1a12] leading-snug">
          {item.product_name}
        </div>
        <div className="inline-flex items-center text-[10px] text-[#7c4e2f] bg-[#f5ece3] px-1.5 py-0.2 rounded font-medium mt-0.5 border border-[#dfcebe]">
          {item.unit || 'PCS'}
        </div>
      </td>
      <td className="py-2.5 px-3 text-right">
        <div className="font-mono font-bold text-xs text-[#332219]">
          {formatRupiah(item.price_applied)}
        </div>
        {isWholesale && item.retail_price > item.price_applied && (
          <div className="text-[10px] line-through text-[#a08573] font-mono">
            {formatRupiah(item.retail_price)}
          </div>
        )}
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center justify-center space-x-1">
          <button
            type="button"
            onClick={() => onUpdateQty(item.product_id, item.qty - 1)}
            className="w-6 h-6 rounded-md bg-[#ebdccf] hover:bg-[#dfcebe] text-[#5c3c26] flex items-center justify-center font-bold transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            min="1"
            value={item.qty}
            onChange={(e) => onUpdateQty(item.product_id, parseInt(e.target.value) || 1)}
            className="w-11 py-0.5 text-center font-mono font-extrabold text-xs text-[#332219] bg-white border border-[#dfcebe] rounded-md focus:border-[#7c4e2f] focus:outline-hidden"
          />
          <button
            type="button"
            onClick={() => onUpdateQty(item.product_id, item.qty + 1)}
            className="w-6 h-6 rounded-md bg-[#7c4e2f] hover:bg-[#683f24] text-white flex items-center justify-center font-bold transition-colors shadow-2xs"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </td>
      <td className="py-2.5 px-3 text-center">
        {isWholesale ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4]">
            <Tag className="w-2.5 h-2.5 mr-0.5" /> Grosir
          </span>
        ) : (
          <span className="text-[10px] text-[#a08573]">-</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className="font-mono font-black text-xs sm:text-sm text-[#7c4e2f]">
          {formatRupiah(item.subtotal_item)}
        </span>
      </td>
      <td className="py-2.5 px-2 text-center">
        <button
          type="button"
          onClick={() => onRemoveItem(item.product_id)}
          title="Hapus baris"
          className="p-1 rounded text-[#a08573] hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
});

export const PosCashierView: React.FC<PosCashierViewProps> = React.memo(({
  products,
  cartItems,
  memberId,
  setMemberId,
  taxEnabled,
  setTaxEnabled,
  taxRate = 11,
  onTaxRateChange,
  subtotal,
  wholesaleSavings,
  discountAmount,
  taxAmount,
  grandTotal,
  totalItemCount,
  onAddToCart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onBarcodeScan,
  onOpenRecentTrx,
  onDirectPayment,
  isCatalogSeeding = false,
  isTouchscreenMode = false
}) => {
  // Quick cash tender input state
  const [cashGivenInput, setCashGivenInput] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER'>('CASH');

  // Dynamic tax rate modal state
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [tempTaxRate, setTempTaxRate] = useState<string>(String(taxRate));

  useEffect(() => {
    setTempTaxRate(String(taxRate));
  }, [taxRate]);
  
  // Held / Pending carts state
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    const saved = localStorage.getItem('ketoko_held_carts');
    return saved ? JSON.parse(saved) : [];
  });
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);

  // Quick Chips for fast search / add
  const quickSearchKeywords = ['Indomie', 'Minyak', 'Gulaku', 'Aqua', 'Sampoerna', 'Deterjen', 'Beras', 'Gula'];

  // Pre-indexed quick items map for instant O(1) click (No searching 24k array on click)
  const quickItemsMap = useMemo(() => {
    const map = new Map<string, Product>();
    const len = products.length;
    for (const kw of quickSearchKeywords) {
      const lower = kw.toLowerCase();
      for (let i = 0; i < len; i++) {
        if (products[i].name.toLowerCase().includes(lower)) {
          map.set(kw, products[i]);
          break;
        }
      }
    }
    return map;
  }, [products]);

  // Calculate change
  const cashGivenNumber = cashGivenInput ? parseFloat(cashGivenInput) || 0 : 0;
  const effectiveCash = cashGivenNumber > 0 ? cashGivenNumber : grandTotal;
  const changeDue = Math.max(0, effectiveCash - grandTotal);
  const isCashSufficient = cashGivenNumber === 0 || cashGivenNumber >= grandTotal;

  // Last scanned item
  const lastScannedItem = cartItems.length > 0 ? cartItems[cartItems.length - 1] : null;

  // Smart Dynamic Quick Cash Presets (6 buttons in 3x2 grid)
  const smartCashPresets = useMemo(() => {
    if (grandTotal <= 0) return [10000, 20000, 50000, 100000, 150000, 200000];
    const presets: number[] = [];

    // Next 10.000
    const next10k = Math.ceil(grandTotal / 10000) * 10000;
    if (next10k > grandTotal) presets.push(next10k);

    // Next 50.000
    const next50k = Math.ceil(grandTotal / 50000) * 50000;
    if (next50k > grandTotal && !presets.includes(next50k)) presets.push(next50k);

    // Next 100.000
    const next100k = Math.ceil(grandTotal / 100000) * 100000;
    if (next100k > grandTotal && !presets.includes(next100k)) presets.push(next100k);

    // Standard high notes
    const commonNotes = [50000, 100000, 200000, 300000, 400000, 500000, 1000000];
    for (const note of commonNotes) {
      if (note > grandTotal && !presets.includes(note) && presets.length < 5) {
        presets.push(note);
      }
    }

    while (presets.length < 5) {
      const last = presets[presets.length - 1] || grandTotal;
      presets.push(last + 50000);
    }

    return presets.slice(0, 5);
  }, [grandTotal]);

  // Format short preset button text
  const formatPresetText = (amt: number) => {
    if (amt >= 1000000) return `${amt / 1000000}jt`;
    if (amt >= 1000) return `${amt / 1000}rb`;
    return amt.toString();
  };

  // Numpad key tap
  const handleNumpadKey = (key: string) => {
    if (key === 'CLEAR') {
      setCashGivenInput('');
    } else if (key === 'BACKSPACE') {
      setCashGivenInput((prev) => prev.slice(0, -1));
    } else if (key === '000') {
      if (cashGivenInput) setCashGivenInput((prev) => prev + '000');
    } else if (key === '00') {
      if (cashGivenInput) setCashGivenInput((prev) => prev + '00');
    } else if (key === 'UANG_PAS') {
      handleSetCashPreset(grandTotal);
    } else {
      setCashGivenInput((prev) => prev + key);
    }
  };

  // Process payment directly without opening duplicate modal
  const handleTriggerPayment = () => {
    if (cartItems.length === 0) return;
    const finalCash = selectedPaymentMethod === 'CASH' 
      ? (cashGivenNumber > 0 ? cashGivenNumber : grandTotal) 
      : grandTotal;
    onDirectPayment(selectedPaymentMethod, finalCash);
    setCashGivenInput('');
  };

  // Keyboard Shortcuts Handler (F1: Search, F4: Bayar, F7: Member, F8: Hold, F9: Buka Laci, F12: Rekap Shift, Esc: Clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        const searchInput = document.getElementById('barcode-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleTriggerPayment();
      } else if (e.key === 'F7') {
        e.preventDefault();
        const memberInput = document.getElementById('member-code-input') as HTMLInputElement;
        if (memberInput) {
          memberInput.focus();
          memberInput.select();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleHoldCurrentCart();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ketoko_open_cash_drawer'));
      } else if (e.key === 'F12') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ketoko_open_shift_report'));
      } else if (e.key === 'Escape') {
        if (cartItems.length > 0 && window.confirm('Kosongkan semua barang dari nota belanja saat ini?')) {
          onClearCart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, grandTotal, cashGivenNumber, selectedPaymentMethod, onClearCart]);

  // Hold current cart
  const handleHoldCurrentCart = () => {
    if (cartItems.length === 0) return;
    const newHold: HeldCart = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      items: [...cartItems],
      memberId: memberId,
      subtotal: grandTotal
    };
    const updated = [newHold, ...heldCarts];
    setHeldCarts(updated);
    localStorage.setItem('ketoko_held_carts', JSON.stringify(updated));
    onClearCart();
  };

  // Restore held cart
  const handleRestoreCart = (hold: HeldCart) => {
    if (cartItems.length > 0 && !window.confirm('Keranjang saat ini berisi item. Ganti dengan nota tunda ini?')) {
      return;
    }
    onClearCart();
    hold.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) {
        onAddToCart(prod, item.qty);
      }
    });
    setMemberId(hold.memberId || '');

    const updated = heldCarts.filter((h) => h.id !== hold.id);
    setHeldCarts(updated);
    localStorage.setItem('ketoko_held_carts', JSON.stringify(updated));
    setIsHeldModalOpen(false);
  };

  // Delete held cart
  const handleDeleteHeldCart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = heldCarts.filter((h) => h.id !== id);
    setHeldCarts(updated);
    localStorage.setItem('ketoko_held_carts', JSON.stringify(updated));
  };

  // Set Cash Given Preset
  const handleSetCashPreset = (amount: number) => {
    setCashGivenInput(amount.toString());
    setSelectedPaymentMethod('CASH');
  };

  return (
    <div className="flex-1 w-full p-1.5 sm:p-3 flex flex-col bg-[#f6f0ea] lg:h-full lg:min-h-0 lg:overflow-hidden">
      
      {/* Top Banner if Seeding */}
      {isCatalogSeeding && (
        <div className="shrink-0 mb-2 flex items-center space-x-2.5 px-3.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold animate-pulse shadow-2xs">
          <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Memuat database produk master ke database lokal... Kasir siap dipakai secara normal.</span>
        </div>
      )}

      {/* Main Cashier Workspace (Split: Left Table 65%, Right Checkout 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 lg:flex-1 lg:min-h-0 items-stretch">
        
        {/* LEFT COLUMN: Fast Barcode Scanner & Expansive Transaction Table (8 of 12 cols) */}
        <div className="lg:col-span-8 flex flex-col lg:h-full space-y-2">
          
          {/* 1. Barcode & Search Bar + Quick Product Chips */}
          <div className="shrink-0 bg-white p-2.5 rounded-2xl border border-[#e4d5c7] shadow-xs space-y-1.5">
            <BarcodeScanner
              onScan={onBarcodeScan}
              products={products}
              onAddToCart={(prod) => onAddToCart(prod, 1)}
            />

            {/* Clean Quick Keyword Chips (Only show if matching products exist in store) */}
            {quickSearchKeywords.some(kw => quickItemsMap.has(kw)) && (
              <div className="flex items-center space-x-1.5 overflow-x-auto pt-0.5 no-scrollbar text-xs">
                <span className="text-[10px] font-bold text-[#8a6b53] uppercase tracking-wider shrink-0 flex items-center pr-1">
                  <Sparkles className="w-3 h-3 mr-1 text-[#96633b]" /> Cepat:
                </span>
                {quickSearchKeywords.filter(kw => quickItemsMap.has(kw)).map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      const match = quickItemsMap.get(kw);
                      if (match) onAddToCart(match, 1);
                    }}
                    className="px-2 py-0.5 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#5c3c26] hover:text-[#3d2617] border border-[#eed7c4] rounded-md text-[11px] font-semibold transition-all shrink-0 active:scale-95 shadow-2xs"
                  >
                    +{kw}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Full Table Transaction Cart */}
          <div className="bg-white rounded-2xl border border-[#e4d5c7] shadow-xs flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden">
            
            {/* Table Header Strip */}
            <div className="px-3.5 py-2 bg-[#fcf8f4] border-b border-[#ebdccf] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-[#faebd7] text-[#7c4e2f] border border-[#ecdac5]">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-[#332219] flex items-center gap-2">
                    <span>Daftar Nota Transaksi</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#faebd7] text-[#7c4e2f] border border-[#ecdac5]">
                      {totalItemCount} Item • {cartItems.length} SKU
                    </span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                {heldCarts.length > 0 && (
                  <button
                    onClick={() => setIsHeldModalOpen(true)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Nota Tunda ({heldCarts.length})</span>
                  </button>
                )}

                {cartItems.length > 0 && (
                  <>
                    <button
                      onClick={handleHoldCurrentCart}
                      title="Tunda transaksi saat ini (F8)"
                      className="px-2.5 py-1 bg-[#fcf5ed] hover:bg-[#faebd7] text-[#7c4e2f] border border-[#ebdccf] rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tunda (F8)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('Kosongkan semua barang dalam nota?')) onClearCart();
                      }}
                      title="Hapus semua item (Esc)"
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Kosongkan</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto max-h-[300px] sm:max-h-[380px] lg:max-h-none lg:flex-1 lg:overflow-y-auto lg:min-h-0 scrollbar-thin bg-white">
              {cartItems.length === 0 ? (
                <div className="h-full min-h-[120px] sm:min-h-[220px] flex flex-col items-center justify-center text-[#8a6b53] p-3 sm:p-6 text-center">
                  {products.length === 0 ? (
                    <div className="max-w-md p-4 sm:p-5 rounded-2xl bg-[#fbf5ee] border border-[#ddc3aa] shadow-xs space-y-2 text-center animate-fadeIn">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-2xl bg-[#faebd7] text-[#96633b] flex items-center justify-center font-bold text-lg sm:text-xl">
                        🛒
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-[#3d2617]">Toko Baru Siap Digunakan!</h4>
                        <p className="text-[11px] sm:text-xs text-[#8a6b53] mt-0.5">
                          Database toko masih kosong (0 Produk). Anda dapat menambah produk di menu <strong>Master Data</strong> atau import file Excel/CSV.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-[#fcf5ed] border border-[#ebdccf] flex items-center justify-center mb-1.5 text-[#96633b] shadow-2xs">
                        <Barcode className="w-5 h-5 sm:w-7 sm:h-7 opacity-80" />
                      </div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-[#3d2617]">Nota Kasir Kosong</h4>
                      <p className="text-[11px] sm:text-xs text-[#8a6b53] mt-0.5 max-w-sm">
                        Scan barcode atau ketik nama barang di kolom pencarian atas.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f7efe6] text-[#5c3c26] border-b border-[#ebdccf] sticky top-0 z-10 select-none text-[11px] font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 w-36">KODE / BARCODE</th>
                      <th className="py-2.5 px-3">NAMA ITEM BARANG</th>
                      <th className="py-2.5 px-3 w-28 text-right">HARGA SATUAN</th>
                      <th className="py-2.5 px-3 w-32 text-center">JUMLAH (QTY)</th>
                      <th className="py-2.5 px-3 w-20 text-center">DISKON</th>
                      <th className="py-2.5 px-3 w-32 text-right">SUBTOTAL</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ebdccf]/60">
                    {cartItems.map((item, index) => (
                      <CartRow
                        key={item.product_id}
                        item={item}
                        index={index}
                        onUpdateQty={onUpdateQty}
                        onRemoveItem={onRemoveItem}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom Keyboard Shortcut Ribbon (Hidden on mobile) */}
            <div className="hidden md:flex px-3.5 py-2 bg-[#fcf8f4] border-t border-[#ebdccf] items-center justify-between text-[11px] text-[#7c4e2f] shrink-0 overflow-x-auto no-scrollbar font-semibold gap-2">
              <div className="flex items-center space-x-3 shrink-0">
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#dfcebe] font-mono text-[9px] font-bold shadow-2xs">F1</kbd>
                  <span>Cari/Scan</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-[#166534] text-white rounded border border-[#14532d] font-mono text-[9px] font-bold shadow-2xs">F4</kbd>
                  <span className="font-bold text-[#166534]">Bayar Cepat</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#dfcebe] font-mono text-[9px] font-bold shadow-2xs">F7</kbd>
                  <span>Member</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#dfcebe] font-mono text-[9px] font-bold shadow-2xs">F8</kbd>
                  <span>Tunda Nota</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#dfcebe] font-mono text-[9px] font-bold shadow-2xs">F9</kbd>
                  <span>Buka Laci</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#dfcebe] font-mono text-[9px] font-bold shadow-2xs">F12</kbd>
                  <span>Rekap Shift</span>
                </span>
              </div>

              <div className="text-[10px] text-[#8a6b53] hidden lg:block shrink-0">
                Ketoko POS • Fast Cashier Mode
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Fully Filled, Professional Retail POS Panel (4 of 12 cols) */}
        <div className="lg:col-span-4 flex flex-col lg:h-full space-y-2 pb-24 lg:pb-0">
          
          {/* CARD 1: MEMBER, PPN & TOTAL TAGIHAN HERO */}
          <div className="bg-white rounded-2xl border border-[#e4d5c7] p-3 shadow-xs space-y-2 shrink-0">
            
            {/* Member & Tax Toggle + Input Mode Switch */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  id="member-code-input"
                  type="text"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  placeholder="ID Member (F7)..."
                  className="w-full pl-8 pr-2 py-1.5 bg-[#fcf8f4] text-[#332219] rounded-xl border border-[#dfcebe] focus:border-[#7c4e2f] focus:bg-white text-xs font-semibold placeholder:text-[#8a6b53] shadow-2xs"
                />
                <UserCheck className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#8a6b53]" />
              </div>

              {/* Dynamic Tax Rate Badge with Quick Edit & Toggle Checkbox */}
              <div className="relative shrink-0 flex items-center">
                <div className={`flex items-center rounded-xl border text-xs shadow-2xs overflow-hidden transition-all ${
                  taxEnabled
                    ? 'bg-[#edf5ee] text-[#166534] border-[#cce2cf]'
                    : 'bg-[#fcf8f4] text-[#7c4e2f] border-[#dfcebe]'
                }`}>
                  {/* Clickable Tax percentage label to edit rate */}
                  <button
                    type="button"
                    onClick={() => setIsTaxModalOpen(true)}
                    title="Klik untuk ubah persentase pajak PPN (bisa diset berapa aja: 0%, 10%, 11%, 12%, dsb)"
                    className="px-2 py-1.5 font-bold hover:bg-black/5 flex items-center space-x-1 transition-colors"
                  >
                    <span>PPN {taxRate}%</span>
                    <span className="text-[10px] opacity-70">✏️</span>
                  </button>

                  {/* Toggle Checkmark button */}
                  <button
                    type="button"
                    onClick={() => setTaxEnabled(!taxEnabled)}
                    title={taxEnabled ? 'Pajak Aktif (Klik untuk nonaktifkan)' : 'Pajak Mati (Klik untuk aktifkan)'}
                    className="px-2 py-1.5 border-l border-inherit hover:bg-black/5 transition-colors flex items-center justify-center"
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${taxEnabled ? 'bg-[#15803d] text-white' : 'bg-[#e5d0be]'}`}>
                      {taxEnabled && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Breakdown lines */}
            <div className="space-y-1 text-xs text-[#543c2e] pt-1 border-t border-[#f0e4d7]">
              <div className="flex justify-between">
                <span className="text-[#8a6b53]">Subtotal Barang</span>
                <span className="font-mono font-bold text-[#332219]">{formatRupiah(subtotal)}</span>
              </div>

              {wholesaleSavings > 0 && (
                <div className="flex justify-between text-[#7c4e2f] font-semibold">
                  <span className="flex items-center">
                    <Tag className="w-3 h-3 mr-1" /> Potongan Grosir
                  </span>
                  <span className="font-mono">-{formatRupiah(wholesaleSavings)}</span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex justify-between text-[#166534] font-semibold">
                  <span className="flex items-center">
                    <Percent className="w-3 h-3 mr-1" /> Diskon Member (5%)
                  </span>
                  <span className="font-mono">-{formatRupiah(discountAmount)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-[#8a6b53]">
                  <span>PPN ({taxRate}%)</span>
                  <span className="font-mono font-bold text-[#332219]">{formatRupiah(taxAmount)}</span>
                </div>
              )}
            </div>

            {/* SOLID RICH GRAND TOTAL CARD */}
            <div className="p-3 bg-[#7c4e2f] text-white rounded-xl shadow-xs space-y-0.5 border border-[#5c3c26]">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#fde68a] uppercase tracking-wider">
                <span>Total Tagihan Pembayaran</span>
                <span className="text-[10px] text-white/80 font-normal">{totalItemCount} Item</span>
              </div>
              <div className="font-mono font-black text-2xl sm:text-3xl text-white tracking-tight leading-none pt-0.5">
                {formatRupiah(grandTotal)}
              </div>
            </div>

          </div>

          {/* CARD 2: METODE BAYAR & CASH/NON-CASH (Fills Remaining Space Ergonomically) */}
          <div className="bg-white rounded-2xl border border-[#e4d5c7] p-3 shadow-xs flex flex-col justify-between space-y-2 lg:flex-1 lg:min-h-0">
            
            {/* 1. Payment Method 4-Grid */}
            <div className="space-y-1 shrink-0">
              <label className="text-[10px] font-extrabold text-[#8a6b53] uppercase tracking-wider block">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'CASH', label: 'Tunai', icon: Wallet },
                  { id: 'QRIS', label: 'QRIS', icon: QrCode },
                  { id: 'DEBIT', label: 'Debit/EDC', icon: CreditCard },
                  { id: 'TRANSFER', label: 'Transfer', icon: Smartphone }
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = selectedPaymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedPaymentMethod(m.id as any)}
                      className={`py-1.5 px-1 rounded-xl border flex flex-col items-center justify-center space-y-1 text-center transition-all ${
                        isSelected
                          ? 'bg-[#7c4e2f] border-[#5c3c26] text-white font-bold shadow-xs'
                          : 'bg-[#fcf8f4] border-[#ebdccf] text-[#5c3c26] hover:bg-[#faebd7] hover:border-[#dfcebe]'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#fde68a]' : 'text-[#7c4e2f]'}`} />
                      <span className="text-[10px] leading-none">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Middle Section: Cash Input & Ergonomic Widgets */}
            {selectedPaymentMethod === 'CASH' ? (
              <div className="flex flex-col justify-between space-y-1.5 bg-[#fcf8f4] p-2.5 rounded-xl border border-[#ebdccf] lg:flex-1 lg:min-h-0">
                
                {/* Input Cash Received */}
                <div className="flex items-center justify-between text-xs shrink-0">
                  <span className="font-bold text-[#5c3c26] flex items-center text-xs">
                    <Coins className="w-3.5 h-3.5 mr-1 text-[#7c4e2f]" /> Uang Diterima:
                  </span>
                  <div className="relative w-36">
                    <input
                      type="number"
                      value={cashGivenInput}
                      onChange={(e) => setCashGivenInput(e.target.value)}
                      placeholder={formatRupiah(grandTotal)}
                      className="w-full px-2.5 py-1 text-right font-mono font-bold text-xs bg-white border border-[#dfcebe] rounded-lg text-[#332219] focus:border-[#7c4e2f] focus:outline-hidden shadow-2xs"
                    />
                  </div>
                </div>

                {/* 6 Quick Cash Presets in 3x2 Grid */}
                <div className="grid grid-cols-3 gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetCashPreset(grandTotal)}
                    className="py-1 px-1 bg-white hover:bg-[#faebd7] text-[#7c4e2f] border border-[#dfcebe] rounded-lg text-[10px] font-bold transition-all active:scale-95 shadow-2xs"
                  >
                    Uang Pas
                  </button>
                  {smartCashPresets.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSetCashPreset(amt)}
                      className={`py-1 px-1 border rounded-lg text-[10px] font-mono font-bold transition-all active:scale-95 shadow-2xs ${
                        cashGivenNumber === amt
                          ? 'bg-[#7c4e2f] text-white border-[#5c3c26]'
                          : 'bg-white hover:bg-[#faebd7] text-[#5c3c26] border-[#dfcebe]'
                      }`}
                    >
                      {formatPresetText(amt)}
                    </button>
                  ))}
                </div>

                {/* CONDITIONAL: MODE DESKTOP (Widgets) vs MODE TOUCHSCREEN (Numpad) */}
                {!isTouchscreenMode ? (
                  /* DESKTOP MODE WIDGETS: Fill empty space with Shift Status, Last Item & Hotkeys */
                  <div className="flex flex-col justify-between space-y-1.5 pt-1 lg:flex-1 lg:min-h-0">
                    
                    {/* Live Kasir Status & Shift Info */}
                    <div className="p-2 bg-white rounded-lg border border-[#e4d5c7] flex items-center justify-between text-[11px] shadow-2xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <div>
                          <div className="font-extrabold text-[#332219] text-[11px]">Kasir 01 • Shift Pagi</div>
                          <div className="text-[9px] text-[#8a6b53]">Supermarket POS Active</div>
                        </div>
                      </div>
                      <LiveDigitalClock />
                    </div>

                    {/* Highlight Last Scanned Item */}
                    {lastScannedItem ? (
                      <div className="p-2 bg-white rounded-lg border border-[#cce2cf] bg-[#f8fdf9] flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <ShoppingBag className="w-4 h-4 text-[#166534] shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[10px] text-[#166534] font-bold">Item Terakhir Ditambahkan:</div>
                            <div className="font-bold text-xs text-[#2a1a12] truncate max-w-[180px]">
                              {lastScannedItem.product_name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-xs text-[#166534]">
                            {lastScannedItem.qty}x {formatRupiah(lastScannedItem.price_applied)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Keyboard Shortcut Helper Grid */
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-[#5c3c26]">
                        <div className="p-1.5 bg-white rounded-lg border border-[#ebdccf] flex items-center space-x-1.5 shadow-2xs">
                          <kbd className="px-1 py-0.2 bg-[#faebd7] text-[#7c4e2f] rounded font-mono font-bold text-[9px]">F1</kbd>
                          <span className="font-medium">Scan Barcode</span>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-[#ebdccf] flex items-center space-x-1.5 shadow-2xs">
                          <kbd className="px-1 py-0.2 bg-[#faebd7] text-[#7c4e2f] rounded font-mono font-bold text-[9px]">F7</kbd>
                          <span className="font-medium">ID Member</span>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-[#ebdccf] flex items-center space-x-1.5 shadow-2xs">
                          <kbd className="px-1 py-0.2 bg-[#faebd7] text-[#7c4e2f] rounded font-mono font-bold text-[9px]">F8</kbd>
                          <span className="font-medium">Tunda Nota</span>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-[#ebdccf] flex items-center space-x-1.5 shadow-2xs">
                          <kbd className="px-1 py-0.2 bg-[#166534] text-white rounded font-mono font-bold text-[9px]">F9</kbd>
                          <span className="font-bold text-[#166534]">Bayar / Cetak</span>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  /* TOUCHSCREEN MODE: Fullsize Keyboard Numpad (4x4 Grid) */
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5 min-h-[160px] lg:flex-1 lg:min-h-0">
                    {/* Row 1: 7, 8, 9, Backspace */}
                    <button type="button" onClick={() => handleNumpadKey('7')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">7</button>
                    <button type="button" onClick={() => handleNumpadKey('8')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">8</button>
                    <button type="button" onClick={() => handleNumpadKey('9')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">9</button>
                    <button type="button" onClick={() => handleNumpadKey('BACKSPACE')} className="rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 font-mono font-bold text-amber-800 shadow-2xs active:scale-95 flex items-center justify-center" title="Hapus satu angka">
                      <Delete className="w-4 h-4" />
                    </button>

                    {/* Row 2: 4, 5, 6, Clear */}
                    <button type="button" onClick={() => handleNumpadKey('4')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">4</button>
                    <button type="button" onClick={() => handleNumpadKey('5')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">5</button>
                    <button type="button" onClick={() => handleNumpadKey('6')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">6</button>
                    <button type="button" onClick={() => handleNumpadKey('CLEAR')} className="rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 font-mono font-bold text-xs text-rose-700 shadow-2xs active:scale-95 flex items-center justify-center" title="Bersihkan input">C</button>

                    {/* Row 3: 1, 2, 3, 00 */}
                    <button type="button" onClick={() => handleNumpadKey('1')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">1</button>
                    <button type="button" onClick={() => handleNumpadKey('2')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">2</button>
                    <button type="button" onClick={() => handleNumpadKey('3')} className="rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">3</button>
                    <button type="button" onClick={() => handleNumpadKey('00')} className="rounded-lg bg-[#faebd7] border border-[#ebdccf] hover:bg-[#eed7c4] font-mono font-bold text-xs text-[#7c4e2f] shadow-2xs active:scale-95 flex items-center justify-center">00</button>

                    {/* Row 4: 0 (Double width like PC numpad), 000, Pas */}
                    <button type="button" onClick={() => handleNumpadKey('0')} className="col-span-2 rounded-lg bg-white border border-[#dfcebe] hover:bg-[#fbf7f2] font-mono font-extrabold text-sm text-[#332219] shadow-2xs active:scale-95 flex items-center justify-center">0</button>
                    <button type="button" onClick={() => handleNumpadKey('000')} className="rounded-lg bg-[#faebd7] border border-[#ebdccf] hover:bg-[#eed7c4] font-mono font-bold text-xs text-[#7c4e2f] shadow-2xs active:scale-95 flex items-center justify-center">000</button>
                    <button type="button" onClick={() => handleNumpadKey('UANG_PAS')} className="rounded-lg bg-[#166534] border border-[#14532d] hover:bg-[#14532d] text-white font-bold text-[10px] shadow-2xs active:scale-95 flex items-center justify-center leading-tight text-center px-1">Pas</button>
                  </div>
                )}

                {/* Kembalian Banner */}
                {effectiveCash > 0 && (
                  <div className={`flex items-center justify-between p-2 rounded-lg border text-xs shrink-0 ${
                    isCashSufficient
                      ? 'bg-[#edf5ee] border-[#cce2cf] text-[#166534]'
                      : 'bg-[#fff1f2] border-[#fecdd3] text-rose-800'
                  }`}>
                    <span className="font-bold">
                      {isCashSufficient ? 'Kembalian:' : 'Uang Kurang:'}
                    </span>
                    <span className="font-mono font-black text-sm">
                      {isCashSufficient 
                        ? formatRupiah(changeDue) 
                        : formatRupiah(grandTotal - cashGivenNumber)}
                    </span>
                  </div>
                )}

              </div>
            ) : (
              /* Non-Cash QRIS / Debit / Transfer Info Box */
              <div className="flex flex-col items-center justify-center p-4 bg-[#fcf8f4] rounded-xl border border-[#ebdccf] text-center space-y-2 lg:flex-1 lg:min-h-0">
                {selectedPaymentMethod === 'QRIS' ? (
                  <>
                    <div className="w-12 h-12 bg-white rounded-xl border border-[#dfcebe] flex items-center justify-center text-[#7c4e2f] shadow-2xs">
                      <QrCode className="w-7 h-7" />
                    </div>
                    <div className="text-xs font-bold text-[#332219]">Pembayaran QRIS Dinamis</div>
                    <div className="text-[11px] text-[#8a6b53] max-w-[200px]">
                      Tampilkan QRIS ke pelanggan untuk scan via BCA, Mandiri, Gopay, OVO, ShopeePay.
                    </div>
                  </>
                ) : selectedPaymentMethod === 'DEBIT' ? (
                  <>
                    <div className="w-12 h-12 bg-white rounded-xl border border-[#dfcebe] flex items-center justify-center text-[#7c4e2f] shadow-2xs">
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <div className="text-xs font-bold text-[#332219]">Mesin EDC / Kartu Debit</div>
                    <div className="text-[11px] text-[#8a6b53] max-w-[200px]">
                      Gesek kartu pada EDC toko. Tekan tombol Bayar setelah slip EDC keluar.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-xl border border-[#dfcebe] flex items-center justify-center text-[#7c4e2f] shadow-2xs">
                      <Smartphone className="w-7 h-7" />
                    </div>
                    <div className="text-xs font-bold text-[#332219]">Transfer Bank Langsung</div>
                    <div className="text-[11px] text-[#8a6b53] max-w-[200px]">
                      Konfirmasi mutasi rekening bank sebelum menekan tombol Proses Bayar.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 3. Main Action Buttons: 1-Click Direct Receipt Print */}
            <div className="space-y-1.5 pt-1 shrink-0">
              <button
                type="button"
                onClick={handleTriggerPayment}
                disabled={cartItems.length === 0}
                className="w-full py-3.5 px-4 bg-[#166534] hover:bg-[#14532d] disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-md flex items-center justify-center space-x-2 text-sm sm:text-base transition-all active:scale-[0.98]"
              >
                <CreditCard className="w-5 h-5 text-amber-300" />
                <span>PROSES BAYAR & CETAK (F9)</span>
              </button>

              {/* Secondary Buttons */}
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={onOpenRecentTrx}
                  className="py-1.5 px-2 bg-[#fcf8f4] hover:bg-[#faebd7] text-[#5c3c26] border border-[#ebdccf] rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-[#7c4e2f]" />
                  <span>Cetak Ulang Nota Terakhir</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL: DAFTAR NOTA TERTUNDA (HOLD LIST) */}
      {isHeldModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-[#e4d5c7] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-3.5 bg-gradient-to-r from-[#7c4e2f] to-[#96633b] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-300" />
                <h3 className="font-extrabold text-sm sm:text-base">Daftar Nota Transaksi Tertunda ({heldCarts.length})</h3>
              </div>
              <button 
                onClick={() => setIsHeldModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="p-3.5 overflow-y-auto flex-1 space-y-2.5">
              {heldCarts.length === 0 ? (
                <p className="text-center text-xs text-[#8a6b53] py-8">Tidak ada nota tertunda.</p>
              ) : (
                heldCarts.map((hold) => (
                  <div
                    key={hold.id}
                    onClick={() => handleRestoreCart(hold)}
                    className="p-3 rounded-2xl bg-[#fcf8f4] border border-[#ebdccf] hover:border-[#7c4e2f] hover:bg-[#faebd7] transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-[#7c4e2f] bg-white px-2 py-0.5 rounded border border-[#dfcebe]">
                          {hold.id}
                        </span>
                        <span className="text-[11px] text-[#8a6b53]">{hold.timestamp}</span>
                        {hold.memberId && (
                          <span className="text-[10px] bg-[#edf5ee] text-[#166534] px-1.5 py-0.2 rounded font-bold">
                            Member: {hold.memberId}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#5c3c26] mt-1 font-medium">
                        {hold.items.length} jenis barang ({hold.items.reduce((acc, i) => acc + i.qty, 0)} total pcs)
                      </div>
                      <div className="font-mono font-black text-sm text-[#7c4e2f] mt-0.5">
                        {formatRupiah(hold.subtotal)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteHeldCart(hold.id, e)}
                        className="p-1.5 rounded-lg text-[#a08573] hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        title="Hapus nota tunda ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-lg bg-[#7c4e2f] text-white text-xs font-bold shadow-xs group-hover:bg-[#683f24] transition-colors"
                      >
                        Buka Nota
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-[#fcf8f4] border-t border-[#ebdccf] text-right">
              <button
                type="button"
                onClick={() => setIsHeldModalOpen(false)}
                className="px-3 py-1.5 bg-[#f5ece3] hover:bg-[#ebdccf] text-[#543c2e] rounded-xl text-xs font-bold transition-colors"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Dynamic Tax Rate Setting Modal */}
      {isTaxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-xs rounded-3xl shadow-2xl p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#ebdccf] pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-[#3d2617]">Atur Persentase Pajak</h4>
                  <p className="text-[10px] text-[#8a6b53]">Masukkan tarif PPN berapa saja</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTaxModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <label className="text-[10px] font-bold text-[#8a6b53] uppercase block mb-1.5">Pilihan Cepat:</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 5, 10, 11, 12].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      onTaxRateChange?.(preset);
                      setTempTaxRate(String(preset));
                      setIsTaxModalOpen(false);
                    }}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      taxRate === preset 
                        ? 'bg-[#166534] text-white border-[#166534] shadow-xs' 
                        : 'bg-white text-[#5c3c26] border-[#ddc3aa] hover:bg-[#faebd7]'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div>
              <label className="text-[10px] font-bold text-[#8a6b53] uppercase block mb-1.5">Atau Masukkan Angka Bebas (%):</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={tempTaxRate}
                  onChange={(e) => setTempTaxRate(e.target.value)}
                  placeholder="e.g. 11"
                  className="w-full pl-3 pr-8 py-2 rounded-xl bg-white border border-[#ddc3aa] text-xs font-bold text-[#3d2617] focus:outline-none focus:border-[#96633b]"
                />
                <span className="absolute right-3 top-2 text-stone-500 font-bold text-xs">%</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setIsTaxModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const parsed = parseFloat(tempTaxRate);
                  if (!isNaN(parsed) && parsed >= 0) {
                    onTaxRateChange?.(parsed);
                  }
                  setIsTaxModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-[#96633b] hover:bg-[#83532e] text-white text-xs font-extrabold shadow-xs transition-all active:scale-95"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
