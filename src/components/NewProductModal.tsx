import React, { useState, useEffect } from 'react';
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
  Loader2 
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
  onProductCreated: () => Promise<void>;
}

export const NewProductModal: React.FC<NewProductModalProps> = ({
  isOpen,
  onClose,
  onProductCreated
}) => {
  const [skuId, setSkuId] = useState('BRG-001');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  
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
  const [rackLocation, setRackLocation] = useState('');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>(5);

  // Image Upload state with WebP conversion
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageMeta, setImageMeta] = useState<ImageConversionResult | null>(null);
  const [isConvertingImage, setIsConvertingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset form cleanly to 0 / empty values
  const resetFormCleanly = async () => {
    try {
      const count = await db.products.count();
      setSkuId(`BRG-${String(count + 1).padStart(3, '0')}`);
    } catch {
      setSkuId('BRG-001');
    }
    setBarcode('');
    setName('');
    setImageUrl('');
    setImageMeta(null);
    setImageError(null);
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
    setRackLocation('');
    setMinStockAlert(5);
  };

  // Load existing categories dynamically from DB and set fresh clean state on modal open
  useEffect(() => {
    if (isOpen) {
      resetFormCleanly();
      db.products.toArray().then((allProds) => {
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
  }, [isOpen]);

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
    if (!name.trim() || isSubmitting) return;

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

      const newProduct: Product = {
        id: skuId.trim() || `BRG-${Date.now()}`,
        barcode: barcode.trim() || skuId.trim(),
        name: name.trim(),
        category: finalCategory,
        unit: finalUnit,
        rack_location: rackLocation.trim() || 'Umum',
        buy_price: parsedBuyPrice,
        retail_price: parsedRetailPrice,
        wholesale_price: parsedWholesalePrice,
        min_wholesale_qty: parsedMinWholesale,
        stock: parsedStock,
        min_stock_alert: parsedMinAlert,
        image_url: imageUrl.trim() || '',
        updated_at: new Date().toISOString()
      };

      await syncService.syncProductChange(newProduct);
      setSuccessMsg(`Produk "${name}" berhasil ditambahkan ke katalog.`);
      await onProductCreated();

      setTimeout(() => {
        setSuccessMsg(null);
        resetFormCleanly();
        onClose();
      }, 800);
    } catch (err: any) {
      alert('Gagal menambah produk: ' + err.message);
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#5c3c26] font-semibold mb-1 block">Kode Produk (SKU ID)</label>
              <input
                type="text"
                value={skuId}
                onChange={(e) => setSkuId(e.target.value)}
                placeholder="BRG-001"
                required
                className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs font-mono focus:bg-white focus:border-[#7c4e2f]"
              />
            </div>
            <div>
              <label className="text-[#5c3c26] font-semibold mb-1 block">Barcode Scanner (11-13 Digit)</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan barcode atau ketik (opsional)..."
                className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs font-mono focus:bg-white focus:border-[#7c4e2f]"
              />
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
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#7c4e2f] hover:bg-[#633e26] disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-[#7c4e2f]/20 flex items-center justify-center space-x-2 text-xs transition-all active:scale-[0.99]"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan ke IndexedDB...' : 'Simpan Produk Baru ke Master Data'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
