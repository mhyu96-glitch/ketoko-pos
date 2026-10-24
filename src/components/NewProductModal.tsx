import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Package, 
  Save, 
  CheckCircle2, 
  Tag, 
  Upload, 
  ImageIcon, 
  Trash2, 
  Sparkles, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { db } from '../db';
import type { Product } from '../types';
import { convertImageFileToWebP, type ImageConversionResult } from '../utils/imageConverter';
import { CustomSelect } from './CustomSelect';
import { syncService } from '../services/syncService';

// Helper: format angka ke string dengan titik ribuan (15555555 → "15.555.555")
const formatRupiah = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('id-ID');
};

// Helper: parse string berformat titik ke number (strip non-digit)
const parseRupiah = (val: string): number => {
  return parseInt(val.replace(/\D/g, ''), 10) || 0;
};

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (newProduct?: Product) => Promise<void> | void;
}

const generateNextUniqueSku = async (): Promise<string> => {
  try {
    const allProds = await db.products.toArray();
    const deletedIds = syncService.getDeletedProductIds();
    const existingIds = new Set<string>();
    let maxBrgNum = allProds.length;

    for (const p of allProds) {
      const idStr = String(p.id).trim();
      existingIds.add(idStr.toUpperCase());
      const match = idStr.match(/^BRG-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxBrgNum) {
          maxBrgNum = num;
        }
      }
    }

    for (const delId of deletedIds) {
      existingIds.add(String(delId).trim().toUpperCase());
      const match = String(delId).trim().match(/^BRG-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxBrgNum) {
          maxBrgNum = num;
        }
      }
    }

    let nextNum = maxBrgNum + 1;
    let candidate = `BRG-${String(nextNum).padStart(3, '0')}`;
    while (existingIds.has(candidate.toUpperCase())) {
      nextNum++;
      candidate = `BRG-${String(nextNum).padStart(3, '0')}`;
    }
    return candidate;
  } catch {
    return `BRG-${Date.now().toString().slice(-5)}`;
  }
};

export const NewProductModal: React.FC<NewProductModalProps> = ({
  isOpen,
  onClose,
  onProductCreated
}) => {
  const [skuId, setSkuId] = useState('BRG-001');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  
  // Real-time Duplicate Detection States
  const [allProductsCache, setAllProductsCache] = useState<Product[]>([]);
  const [skuDuplicate, setSkuDuplicate] = useState<Product | null>(null);
  const [barcodeDuplicate, setBarcodeDuplicate] = useState<Product | null>(null);

  // Category state
  const [category, setCategory] = useState('Sembako');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [existingCategories, setExistingCategories] = useState<string[]>([
    'Sembako',
    'Minuman',
    'Mie & Makanan Instan',
    'Perawatan Tubuh',
    'Kebersihan',
    'Snack & Biskuit',
    'Lain-lain'
  ]);

  // Unit state
  const [unit, setUnit] = useState('Pcs');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnitInput, setCustomUnitInput] = useState('');

  // Prices & Stock - string state untuk format titik ribuan (e.g. "15.555.555")
  const [buyPrice, setBuyPrice] = useState<string>('');
  const [retailPrice, setRetailPrice] = useState<string>('');
  const [wholesalePrice, setWholesalePrice] = useState<string>('');
  const [minWholesaleQty, setMinWholesaleQty] = useState<number | ''>('');
  const [stock, setStock] = useState<number | ''>('');
  const [rackLocation, setRackLocation] = useState('Gudang Utama');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>(5);

  // Image Upload state with WebP conversion
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageMeta, setImageMeta] = useState<ImageConversionResult | null>(null);
  const [isConvertingImage, setIsConvertingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load fresh products cache from local database
  const refreshProductCache = useCallback(async () => {
    try {
      const allProds = await db.products.toArray();
      setAllProductsCache(allProds);
      return allProds;
    } catch {
      return [];
    }
  }, []);

  // Generate next guaranteed unique SKU and clear duplicate warning
  const handleAutoGenerateSku = useCallback(async () => {
    const nextSku = await generateNextUniqueSku();
    setSkuId(nextSku);
    setSkuDuplicate(null);
  }, []);

  // Reset form cleanly to 0 / empty values
  const resetFormCleanly = async () => {
    const nextSku = await generateNextUniqueSku();
    setSkuId(nextSku);
    setBarcode('');
    setName('');
    setImageUrl('');
    setImageMeta(null);
    setImageError(null);
    setSubmitError(null);
    setSkuDuplicate(null);
    setBarcodeDuplicate(null);
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setIsCustomUnit(false);
    setCustomUnitInput('');
    setCategory('Sembako');
    setUnit('Pcs');
    setBuyPrice('');
    setRetailPrice('');
    setWholesalePrice('');
    setMinWholesaleQty('');
    setStock('');
    setRackLocation('Gudang Utama');
    setMinStockAlert(5);
  };

  // Load existing categories dynamically from DB and set fresh clean state on modal open
  useEffect(() => {
    if (isOpen) {
      resetFormCleanly();
      refreshProductCache().then((allProds) => {
        const cats = Array.from(new Set(allProds.map((p) => p.category).filter(Boolean)));
        if (cats.length > 0) {
          const merged = Array.from(new Set([
            ...cats,
            'Sembako',
            'Minuman',
            'Mie & Makanan Instan',
            'Perawatan Tubuh',
            'Kebersihan',
            'Snack & Biskuit',
            'Lain-lain'
          ]));
          setExistingCategories(merged);
        }
      }).catch(console.error);
    }
  }, [isOpen, refreshProductCache]);

  // Real-time instant duplicate detection for SKU (Kode Produk)
  useEffect(() => {
    const cleanSku = skuId.trim().toLowerCase();
    if (!cleanSku || allProductsCache.length === 0) {
      setSkuDuplicate(null);
      return;
    }

    const match = allProductsCache.find((p) => {
      const pId = String(p.id).trim().toLowerCase();
      const pBarcode = String(p.barcode || '').trim().toLowerCase();
      return pId === cleanSku || (pBarcode && pBarcode === cleanSku);
    });

    setSkuDuplicate(match || null);
  }, [skuId, allProductsCache]);

  // Real-time instant duplicate detection for Barcode Scanner
  useEffect(() => {
    const cleanBarcode = barcode.trim().toLowerCase();
    if (!cleanBarcode || allProductsCache.length === 0) {
      setBarcodeDuplicate(null);
      return;
    }

    const currentSku = skuId.trim().toLowerCase();
    const match = allProductsCache.find((p) => {
      const pId = String(p.id).trim().toLowerCase();
      const pBarcode = String(p.barcode || '').trim().toLowerCase();
      // Jangan flag jika sama persis dengan SKU yang sedang dibuat saat ini
      if (pId === currentSku && !skuDuplicate) return false;
      return pBarcode === cleanBarcode || pId === cleanBarcode;
    });

    setBarcodeDuplicate(match || null);
  }, [barcode, skuId, allProductsCache, skuDuplicate]);

  if (!isOpen) return null;

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsConvertingImage(true);
    setImageError(null);

    try {
      const result = await convertImageFileToWebP(file, 600, 600, 0.85);
      setImageUrl(result.dataUrl);
      setImageMeta(result);
    } catch (err: any) {
      setImageError(err.message || 'Gagal memproses gambar');
    } finally {
      setIsConvertingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImageMeta(null);
    setImageError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError('Nama produk wajib diisi.');
      return;
    }

    if (isSubmitting) return;

    // 1. Guard Duplikasi Real-time: Tolak jika SKU sudah terpakai
    if (skuDuplicate) {
      setSubmitError(`Kode Produk "${skuId}" sudah terpakai oleh "${skuDuplicate.name}". Ganti kode lain agar tidak double input!`);
      return;
    }

    // 2. Guard Duplikasi Real-time: Tolak jika Barcode sudah terpakai
    if (barcodeDuplicate) {
      setSubmitError(`Barcode "${barcode}" sudah terpakai oleh "${barcodeDuplicate.name}". Ganti barcode lain agar tidak double input!`);
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCategory = isCustomCategory && customCategoryInput.trim() 
        ? customCategoryInput.trim() 
        : (category || 'Umum');
        
      const finalUnit = isCustomUnit && customUnitInput.trim() 
        ? customUnitInput.trim() 
        : (unit || 'Pcs');

      const parsedBuyPrice = parseRupiah(buyPrice);
      const parsedRetailPrice = parseRupiah(retailPrice);
      const parsedWholesalePrice = parseRupiah(wholesalePrice) || parsedRetailPrice;
      const parsedMinWholesale = Number(minWholesaleQty) || 1;
      const parsedStock = Number(stock) || 0;
      const parsedMinAlert = Number(minStockAlert) || 5;

      const finalSkuId = skuId.trim() || (await generateNextUniqueSku());

      // Verifikasi langsung ke database IndexedDB (keamanan ganda)
      const existingProduct = await db.products.get(finalSkuId);
      if (existingProduct) {
        setSkuDuplicate(existingProduct);
        setSubmitError(`Kode SKU "${finalSkuId}" sudah terdaftar pada produk "${existingProduct.name}". Silakan gunakan tombol "Buat Kode Baru Otomatis".`);
        setIsSubmitting(false);
        return;
      }

      if (barcode.trim()) {
        const existingBarcode = await db.products.where('barcode').equals(barcode.trim()).first();
        if (existingBarcode && existingBarcode.id !== finalSkuId) {
          setBarcodeDuplicate(existingBarcode);
          setSubmitError(`Barcode "${barcode.trim()}" sudah digunakan oleh produk "${existingBarcode.name}". Masukkan barcode lain yang unik.`);
          setIsSubmitting(false);
          return;
        }
      }

      const newProduct: Product = {
        id: finalSkuId,
        store_id: syncService.getActiveStoreId(),
        barcode: barcode.trim() || finalSkuId,
        name: name.trim(),
        category: finalCategory,
        unit: finalUnit,
        rack_location: rackLocation.trim() || 'Gudang Utama',
        buy_price: parsedBuyPrice,
        retail_price: parsedRetailPrice,
        wholesale_price: parsedWholesalePrice,
        min_wholesale_qty: parsedMinWholesale,
        stock: parsedStock,
        min_stock_alert: parsedMinAlert,
        image_url: imageUrl.trim() || '',
        updated_at: new Date().toISOString()
      };

      // Pastikan tombstone dibersihkan dan produk tersimpan langsung ke Dexie & Cloud
      await syncService.syncProductChange(newProduct);
      setSuccessMsg(`Produk "${name}" (${finalSkuId}) berhasil ditambahkan ke katalog.`);
      
      // Update state di komponen induk (App.tsx / ProductPriceListView)
      await onProductCreated(newProduct);
      await refreshProductCache();

      setTimeout(() => {
        setSuccessMsg(null);
        resetFormCleanly();
        onClose();
      }, 600);
    } catch (err: any) {
      setSubmitError('Gagal menambah produk: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] select-text">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#5e3519] bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#543017] text-amber-200 border border-[#9b663b]/50 shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Tambah Item Baru (Master Data)</h3>
              <p className="text-xs text-[#fcefe3]">Daftarkan SKU produk baru dengan foto WebP, kategori kustom, harga eceran & grosir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#543017] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs bg-[#fcf9f5]">
          
          {/* Photo Upload & WebP Conversion Section */}
          <div className="p-4 bg-white rounded-2xl border border-[#e5d0be] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#3d2617] font-bold text-xs flex items-center">
                <ImageIcon className="w-4 h-4 mr-1.5 text-[#7c4e2f]" />
                Foto / Gambar Produk (Otomatis Dikonversi ke WebP)
              </span>
              <span className="text-[10px] text-[#8a6b53] font-medium flex items-center">
                <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                Format .WebP Ringan & HD
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Image Preview Box */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-[#ddc3aa] bg-[#fcf9f5] flex items-center justify-center overflow-hidden shrink-0 group">
                {imageUrl ? (
                  <>
                    <img 
                      src={imageUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-xs"
                        title="Hapus foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#a08573] p-2 text-center">
                    <ImageIcon className="w-7 h-7 mb-1 opacity-50 text-[#7c4e2f]" />
                    <span className="text-[10px] leading-tight">Belum ada foto</span>
                  </div>
                )}

                {isConvertingImage && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white text-[10px] space-y-1">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                    <span>Konversi WebP...</span>
                  </div>
                )}
              </div>

              {/* Upload Controls & Stats */}
              <div className="flex-1 space-y-2 text-left w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-4 py-2 bg-[#7c4e2f] hover:bg-[#633e26] text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{imageUrl ? 'Ganti Foto Produk' : 'Pilih Foto dari Perangkat'}</span>
                    <input 
                      type="file" 
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp" 
                      onChange={handleImageFileChange} 
                      className="hidden" 
                    />
                  </label>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-3 py-2 bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] rounded-xl text-xs font-bold border border-[#ddc3aa] transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#8a6b53] leading-relaxed">
                  Format gambar apa saja (PNG, JPG, JPEG) akan secara otomatis dikompres dan dikonversi ke format <b>WebP</b> modern agar ukuran hemat dan sistem POS berjalan sangat cepat.
                </p>

                {imageMeta && (
                  <div className="flex items-center space-x-2 pt-0.5 animate-fadeIn">
                    <span className="px-2 py-0.5 rounded-lg bg-[#edf5ee] text-[#166534] border border-[#cce2cf] text-[10px] font-bold">
                      ✓ WebP Aktif: {imageMeta.webpSizeKb} KB
                    </span>
                    <span className="text-[10px] text-[#8a6b53]">
                      (Dimensi: {imageMeta.width}x{imageMeta.height} px • Hemat dari {imageMeta.originalSizeKb} KB)
                    </span>
                  </div>
                )}

                {imageError && (
                  <p className="text-[11px] text-rose-600 font-semibold animate-fadeIn">{imageError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Row 1: Kode SKU & Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#5c3c26] font-semibold text-xs flex items-center space-x-1">
                  <span>Kode Produk (SKU ID)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateSku}
                  className="text-[10px] font-bold text-[#7c4e2f] hover:underline flex items-center space-x-0.5"
                  title="Generate kode unik otomatis berikutnya"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Auto SKU</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={skuId}
                  onChange={(e) => setSkuId(e.target.value.toUpperCase())}
                  placeholder="e.g. BRG-001, AC-101"
                  required
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                    skuDuplicate
                      ? 'bg-rose-50/70 border-rose-500 text-rose-950 ring-2 ring-rose-500/20'
                      : 'bg-white text-[#3d2617] border-[#ddc3aa] focus:bg-white focus:border-[#7c4e2f]'
                  }`}
                />
                {skuDuplicate && (
                  <div className="absolute right-2.5 top-2.5 pointer-events-none text-rose-600">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Notifikasi Real-time Jika Kode Item Sudah Terpakai */}
              {skuDuplicate && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs animate-fadeIn shadow-2xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-black text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>⚠️ KODE SUDAH TERPAKAI!</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-rose-200 rounded font-mono font-bold text-rose-950">
                      {skuDuplicate.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-snug">
                    Kode ini sudah terdaftar pada: <b>{skuDuplicate.name}</b>
                    {skuDuplicate.category ? ` (${skuDuplicate.category})` : ''}
                    {skuDuplicate.stock != null ? ` • Stok: ${skuDuplicate.stock} ${skuDuplicate.unit || 'Pcs'}` : ''}
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoGenerateSku}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold shadow-2xs flex items-center space-x-1 transition-all active:scale-95 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-200" />
                      <span>Ganti Kode Unik Otomatis</span>
                    </button>
                    <span className="text-[10px] text-rose-600 italic">
                      Harap ganti kode agar tidak double input!
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#5c3c26] font-semibold text-xs">Barcode Scanner (11-13 Digit)</label>
                <span className="text-[10px] text-[#8a6b53] font-medium">Opsional</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value.trim())}
                  placeholder="Scan barcode fisik produk..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                    barcodeDuplicate
                      ? 'bg-rose-50/70 border-rose-500 text-rose-950 ring-2 ring-rose-500/20'
                      : 'bg-white text-[#3d2617] border-[#ddc3aa] focus:bg-white focus:border-[#7c4e2f]'
                  }`}
                />
                {barcodeDuplicate && (
                  <div className="absolute right-2.5 top-2.5 pointer-events-none text-rose-600">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Notifikasi Real-time Jika Barcode Sudah Terpakai */}
              {barcodeDuplicate && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs animate-fadeIn shadow-2xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-black text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>⚠️ BARCODE SUDAH TERPAKAI!</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-rose-200 rounded font-mono font-bold text-rose-950">
                      {barcodeDuplicate.barcode}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-snug">
                    Barcode ini sudah terdaftar pada: <b>{barcodeDuplicate.name}</b> (SKU: {barcodeDuplicate.id}).
                  </p>
                  <span className="text-[10px] text-rose-600 font-medium block">
                    Gunakan barcode fisik lain yang unik agar kasir tidak salah scan produk.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Nama Produk */}
          <div>
            <label className="text-[#5c3c26] font-semibold mb-1 block">Nama Produk / Barang</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Minyak Goreng Tropical 2L, Beras Ramos 10kg"
              required
              className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#7c4e2f]"
            />
          </div>

          {/* Row 3: Kategori, Satuan, Lokasi Rak */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Kategori / Jenis Item */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#5c3c26] font-semibold text-xs">Kategori / Jenis</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(!isCustomCategory);
                    if (!isCustomCategory) {
                      setCustomCategoryInput('');
                    }
                  }}
                  className="text-[10px] font-bold text-[#7c4e2f] hover:underline"
                >
                  {isCustomCategory ? '← Pilih dari List' : '+ Kategori Baru'}
                </button>
              </div>

              {isCustomCategory ? (
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(e) => {
                    setCustomCategoryInput(e.target.value);
                    setCategory(e.target.value);
                  }}
                  placeholder="e.g. Frozen Food, Kosmetik..."
                  required={isCustomCategory}
                  className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#7c4e2f] text-xs font-semibold focus:ring-2 focus:ring-[#7c4e2f]/20 shadow-2xs animate-fadeIn"
                  autoFocus
                />
              ) : (
                <CustomSelect
                  value={category}
                  onChange={(val) => {
                    if (val === '__ADD_NEW__') {
                      setIsCustomCategory(true);
                      setCustomCategoryInput('');
                    } else {
                      setCategory(val);
                    }
                  }}
                  options={[
                    ...existingCategories.map((c) => ({ value: c, label: c })),
                    { value: '__ADD_NEW__', label: '+ Input Kategori Baru...', sublabel: 'Ketik nama kategori custom baru' }
                  ]}
                />
              )}
            </div>

            {/* Satuan (Unit) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#5c3c26] font-semibold text-xs">Satuan (Unit)</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomUnit(!isCustomUnit);
                    if (!isCustomUnit) {
                      setCustomUnitInput('');
                    }
                  }}
                  className="text-[10px] font-bold text-[#7c4e2f] hover:underline"
                >
                  {isCustomUnit ? '← Pilih Satuan' : '+ Satuan Baru'}
                </button>
              </div>

              {isCustomUnit ? (
                <input
                  type="text"
                  value={customUnitInput}
                  onChange={(e) => {
                    setCustomUnitInput(e.target.value);
                    setUnit(e.target.value);
                  }}
                  placeholder="e.g. Kg, Slop, Dus..."
                  required={isCustomUnit}
                  className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#7c4e2f] text-xs font-semibold focus:ring-2 focus:ring-[#7c4e2f]/20 shadow-2xs animate-fadeIn"
                  autoFocus
                />
              ) : (
                <CustomSelect
                  value={unit}
                  onChange={(val) => {
                    if (val === '__ADD_NEW__') {
                      setIsCustomUnit(true);
                      setCustomUnitInput('');
                    } else {
                      setUnit(val);
                    }
                  }}
                  options={[
                    'Pcs',
                    'Pouch',
                    'Sak',
                    'Bks',
                    'Kotak',
                    'Renceng',
                    'Botol',
                    'Kg',
                    'Liter',
                    'Dus',
                    { value: '__ADD_NEW__', label: '+ Input Satuan Baru...', sublabel: 'Ketik satuan custom' }
                  ]}
                />
              )}
            </div>

            <div>
              <label className="text-[#5c3c26] font-semibold mb-1 block">Lokasi Rak</label>
              <input
                type="text"
                value={rackLocation}
                onChange={(e) => setRackLocation(e.target.value)}
                placeholder="Contoh: RAK-A1 (opsional)"
                className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs font-mono focus:bg-white focus:border-[#7c4e2f]"
              />
            </div>
          </div>

          {/* Row 4: Pricing Tier */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#e5d0be] space-y-3 shadow-xs">
            <span className="text-[#3d2617] font-bold text-xs flex items-center">
              <Tag className="w-3.5 h-3.5 mr-1 text-[#7c4e2f]" />
              Skema Harga & Tier Grosir Otomatis
            </span>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[#8a6b53] mb-1 block text-[11px]">Harga Beli (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(formatRupiah(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-lg border border-[#ddc3aa] font-mono"
                />
              </div>

              <div>
                <label className="text-[#8a6b53] mb-1 block text-[11px]">Harga Eceran (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(formatRupiah(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#fcf9f5] text-[#166534] font-bold rounded-lg border border-[#ddc3aa] font-mono"
                />
              </div>

              <div>
                <label className="text-[#8a6b53] mb-1 block text-[11px]">Harga Grosir (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(formatRupiah(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#fcf9f5] text-[#7c4e2f] font-bold rounded-lg border border-[#ddc3aa] font-mono"
                />
              </div>

              <div>
                <label className="text-[#8a6b53] mb-1 block text-[11px]">Min. Qty Grosir</label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={minWholesaleQty}
                  onChange={(e) => setMinWholesaleQty(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 bg-[#fcf9f5] text-[#3d2617] rounded-lg border border-[#ddc3aa] font-mono text-center"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Stok Awal & Alert Minimum */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#5c3c26] font-semibold mb-1 block">Stok Awal ({unit})</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono text-xs focus:bg-white focus:border-[#7c4e2f]"
              />
            </div>

            <div>
              <label className="text-[#5c3c26] font-semibold mb-1 block">Peringatan Stok Minimum (&le; Alert)</label>
              <input
                type="number"
                min="0"
                placeholder="5"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white text-[#7c4e2f] rounded-xl border border-[#ddc3aa] font-mono text-xs focus:bg-white focus:border-[#7c4e2f]"
              />
            </div>
          </div>

          {/* Error & Duplicate Blocking Warning */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center space-x-2 animate-fadeIn shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {(skuDuplicate || barcodeDuplicate) && !submitError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center space-x-2 animate-fadeIn shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {skuDuplicate && barcodeDuplicate
                  ? 'Kode Produk dan Barcode sudah digunakan! Harap perbaiki sebelum menyimpan agar tidak double input.'
                  : skuDuplicate
                  ? `Kode Produk "${skuId}" sudah terdaftar pada produk lain. Gunakan kode unik agar tidak double input.`
                  : `Barcode "${barcode}" sudah terdaftar pada produk lain. Gunakan barcode unik agar tidak double input.`}
              </span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-[#edf5ee] border border-[#cce2cf] text-[#166534] text-xs text-center font-semibold flex items-center justify-center space-x-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-[#166534]" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !!skuDuplicate || !!barcodeDuplicate}
              className={`w-full py-3.5 font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 text-xs transition-all active:scale-[0.99] ${
                skuDuplicate || barcodeDuplicate
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed border border-stone-300 shadow-none'
                  : 'bg-[#7c4e2f] hover:bg-[#633e26] disabled:opacity-40 text-white shadow-[#7c4e2f]/20'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Menyimpan ke IndexedDB...'
                  : skuDuplicate || barcodeDuplicate
                  ? 'Perbaiki Kode / Barcode Duplikat Sebelum Menyimpan'
                  : 'Simpan Produk Baru ke Master Data'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
