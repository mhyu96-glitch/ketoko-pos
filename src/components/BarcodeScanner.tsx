import React, { useState, useRef, useEffect } from 'react';
import { 
  ScanBarcode, 
  Search, 
  Camera, 
  Zap, 
  AlertCircle, 
  Plus, 
  X 
} from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah } from '../services/escposService';
import { CameraScannerModal } from './CameraScannerModal';

interface BarcodeScannerProps {
  onScan: (query: string) => Promise<{ found: boolean; product?: Product; latencyMs: number }>;
  products?: Product[];
  onAddToCart?: (product: Product, qty?: number) => void;
}

let sharedAudioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!sharedAudioCtx && typeof window !== 'undefined') {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) sharedAudioCtx = new AudioCtxClass();
    } catch {
      // Audio context restricted or unavailable
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

export const BarcodeScanner: React.FC<BarcodeScannerProps> = React.memo(({ 
  onScan, 
  products = [], 
  onAddToCart 
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastScanInfo, setLastScanInfo] = useState<{ name: string; latencyMs: number; success: boolean } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced query state for instant non-blocking autocomplete
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(queryInput);
    }, 80);
    return () => clearTimeout(handler);
  }, [queryInput]);

  // Live matching products for autocomplete dropdown with early exit
  const matchingProducts = React.useMemo(() => {
    const clean = debouncedQuery.trim().toLowerCase();
    if (!clean || clean.length < 2) return [];
    
    const results: Product[] = [];
    const len = products.length;
    for (let i = 0; i < len; i++) {
      const p = products[i];
      if (
        p.name.toLowerCase().includes(clean) ||
        p.barcode.includes(clean) ||
        p.id.toLowerCase().includes(clean) ||
        (p.category && p.category.toLowerCase().includes(clean))
      ) {
        results.push(p);
        if (results.length >= 6) break; // EARLY EXIT: Stop searching 24k items as soon as 6 are found
      }
    }
    return results;
  }, [debouncedQuery, products]);

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = queryInput.trim();
    if (!clean) return;

    setIsScanning(true);
    setIsDropdownOpen(false);
    const result = await onScan(clean);
    setIsScanning(false);

    if (result.found && result.product) {
      setLastScanInfo({
        name: result.product.name,
        latencyMs: result.latencyMs,
        success: true
      });
      playBeep(880, 80);
    } else {
      setLastScanInfo({
        name: `Barang / Barcode "${clean}" tidak ditemukan`,
        latencyMs: result.latencyMs,
        success: false
      });
      playBeep(330, 150);
    }

    setQueryInput('');
    inputRef.current?.focus();
  };

  const handleSelectProduct = (product: Product) => {
    if (onAddToCart) {
      onAddToCart(product, 1);
    } else {
      onScan(product.barcode);
    }
    setLastScanInfo({
      name: product.name,
      latencyMs: 12,
      success: true
    });
    playBeep(880, 80);
    setQueryInput('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleCameraDetected = async (barcode: string) => {
    setIsScanning(true);
    const result = await onScan(barcode);
    setIsScanning(false);

    if (result.found && result.product) {
      setLastScanInfo({
        name: result.product.name,
        latencyMs: result.latencyMs,
        success: true
      });
      playBeep(880, 80);
    } else {
      setLastScanInfo({
        name: `Barcode Kamera "${barcode}" tidak terdaftar`,
        latencyMs: result.latencyMs,
        success: false
      });
      playBeep(330, 150);
    }
  };

  const playBeep = (freq: number, duration: number) => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
      osc.start();
      osc.stop(audioCtx.currentTime + duration / 1000);
    } catch {
      // Audio context might be restricted
    }
  };

  return (
    <div ref={containerRef} className="relative bg-white rounded-2xl p-2 sm:p-2.5 border border-[#e4d5c7] shadow-xs">
      
      {/* Search & Scanner Input Bar (Compact Coklat Susu) */}
      <form onSubmit={handleScanSubmit} className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#856b59]">
          <Search className="w-3.5 h-3.5 text-[#7c4e2f]" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={queryInput}
          onChange={(e) => {
            setQueryInput(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => {
            if (queryInput.length >= 2) setIsDropdownOpen(true);
          }}
          placeholder="Cari nama barang / barcode..."
          className="w-full pl-8 sm:pl-9 pr-20 sm:pr-36 py-2 bg-[#fcf8f4] text-[#332219] rounded-xl border border-[#dfcebe] focus:bg-white focus:border-[#7c4e2f] focus:ring-1 focus:ring-[#7c4e2f] text-xs font-medium placeholder:text-[#a08573] transition-all shadow-inner"
          autoComplete="off"
        />

        {queryInput && (
          <button
            type="button"
            onClick={() => {
              setQueryInput('');
              setIsDropdownOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-16 sm:right-28 p-1 text-[#856b59] hover:text-[#332219]"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        <div className="absolute inset-y-0 right-1 flex items-center pr-0.5 space-x-1">
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            title="Scan Barcode Kamera"
            className="flex items-center space-x-1 px-2 py-1 bg-[#f5ece3] hover:bg-[#ebdccf] text-[#543c2e] hover:text-[#332219] text-[11px] font-semibold rounded-lg transition-colors border border-[#dfcebe] shadow-xs"
          >
            <Camera className="w-3.5 h-3.5 text-[#7c4e2f]" />
            <span className="hidden sm:inline">Kamera</span>
          </button>

          <button
            type="submit"
            disabled={!queryInput.trim() || isScanning}
            className="px-2 sm:px-2.5 py-1 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-40 text-white text-[11px] font-bold rounded-lg transition-colors shadow-xs flex items-center space-x-1"
          >
            <ScanBarcode className="w-3.5 h-3.5 text-amber-200" />
            <span className="hidden sm:inline">{isScanning ? '...' : 'Cari'}</span>
          </button>
        </div>
      </form>

      {/* Smart Live Autocomplete Dropdown */}
      {isDropdownOpen && matchingProducts.length > 0 && (
        <div className="absolute left-2.5 right-2.5 top-full mt-1 bg-white border border-[#e4d5c7] rounded-2xl shadow-xl z-50 overflow-hidden animate-fadeIn divide-y divide-[#f0e4d7]">
          <div className="px-3 py-1 bg-[#f5ece3] text-[10px] font-bold text-[#634837] uppercase tracking-wider flex items-center justify-between">
            <span>Saran Produk ({matchingProducts.length})</span>
            <span className="text-[9px] text-[#856b59] font-normal">Klik untuk tambah ke nota</span>
          </div>

          {matchingProducts.map((prod) => (
            <div
              key={prod.id}
              onClick={() => handleSelectProduct(prod)}
              className="p-2 hover:bg-[#fcf5ed] flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center space-x-1.5">
                  <span className="font-mono text-[9px] font-bold text-[#7c4e2f] bg-[#faebd7] px-1 py-0.2 rounded border border-[#ecdac5]">
                    {prod.id}
                  </span>
                  <h4 className="text-xs font-bold text-[#332219] group-hover:text-[#7c4e2f] truncate leading-tight">
                    {prod.name}
                  </h4>
                </div>
                <div className="flex items-center space-x-1.5 text-[9px] text-[#856b59] mt-0.5">
                  <span className="font-mono">{prod.barcode}</span>
                  <span>•</span>
                  <span className="bg-[#f5ece3] px-1 rounded text-[#543c2e] font-mono">{prod.rack_location}</span>
                  <span>•</span>
                  <span>Stok: <b>{prod.stock}</b></span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <span className="font-mono font-extrabold text-xs text-[#332219]">
                  {formatRupiah(prod.retail_price)}
                </span>
                <button
                  type="button"
                  className="p-1 rounded bg-[#96633b] text-white group-hover:bg-[#83532e] shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scan Feedback Info */}
      {lastScanInfo && (
        <div className="mt-1.5 flex items-center justify-end">
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-medium animate-fadeIn shrink-0 ${
              lastScanInfo.success
                ? 'bg-[#edf5ee] text-[#166534] border border-[#cce2cf]'
                : 'bg-[#fbeeed] text-rose-800 border border-[#f4cfcf]'
            }`}
          >
            {lastScanInfo.success ? (
              <>
                <Zap className="w-3 h-3 text-[#166534]" />
                <span className="font-bold text-[#166534]">{lastScanInfo.latencyMs.toFixed(1)}ms</span>
                <span className="truncate max-w-[200px] text-[#543c2e]">✓ {lastScanInfo.name}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-rose-500" />
                <span className="truncate max-w-[220px] font-semibold">{lastScanInfo.name}</span>
              </>
            )}
          </div>
        </div>
      )}

      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDetected={handleCameraDetected}
        products={products}
      />

    </div>
  );
});
