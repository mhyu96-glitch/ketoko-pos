import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  ShoppingBag, 
  X,
  Upload,
  ImageIcon,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  Download,
  AlertCircle,
  FileUp
} from 'lucide-react';
import { db } from '../db';
import type { Product } from '../types';
import { formatRupiah } from '../services/escposService';
import { convertImageFileToWebP, type ImageConversionResult } from '../utils/imageConverter';
import { CustomSelect } from './CustomSelect';

interface ProductPriceListViewProps {
  products: Product[];
  onGoToPOS: () => void;
  onOpenNewProduct: () => void;
  onProductsUpdated: () => Promise<void>;
}

export const ProductPriceListView: React.FC<ProductPriceListViewProps> = React.memo(({
  products,
  onGoToPOS,
  onOpenNewProduct,
  onProductsUpdated
}) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory]);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState<number>(0);
  const [editRetailPrice, setEditRetailPrice] = useState<number>(0);
  const [editWholesalePrice, setEditWholesalePrice] = useState<number>(0);
  const [editMinWholesaleQty, setEditMinWholesaleQty] = useState<number>(1);
  const [editStock, setEditStock] = useState<number>(0);
  const [editRackLocation, setEditRackLocation] = useState('');
  const [editCategory, setEditCategory] = useState('Sembako');
  const [editUnit, setEditUnit] = useState('Pcs');

  // Edit Image state with WebP conversion
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [editImageMeta, setEditImageMeta] = useState<ImageConversionResult | null>(null);
  const [isConvertingImage, setIsConvertingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const categories = React.useMemo(() => {
    const catSet = new Set<string>();
    const len = products.length;
    for (let i = 0; i < len; i++) {
      if (products[i].category) catSet.add(products[i].category);
    }
    return ['ALL', ...Array.from(catSet).sort()];
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q && selectedCategory === 'ALL') return products;

    return products.filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.rack_location.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [products, debouncedSearch, selectedCategory]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const pageItems = React.useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const handleStartEdit = (prod: Product) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditBuyPrice(prod.buy_price);
    setEditRetailPrice(prod.retail_price);
    setEditWholesalePrice(prod.wholesale_price);
    setEditMinWholesaleQty(prod.min_wholesale_qty);
    setEditStock(prod.stock);
    setEditRackLocation(prod.rack_location);
    setEditCategory(prod.category || 'Sembako');
    setEditUnit(prod.unit || 'Pcs');
    setEditImageUrl(prod.image_url || '');
    setEditImageMeta(null);
    setImageError(null);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsConvertingImage(true);
    setImageError(null);

    try {
      const result = await convertImageFileToWebP(file, 600, 600, 0.85);
      setEditImageUrl(result.dataUrl);
      setEditImageMeta(result);
    } catch (err: any) {
      setImageError(err.message || 'Gagal memproses gambar');
    } finally {
      setIsConvertingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setEditImageUrl('');
    setEditImageMeta(null);
    setImageError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || isSaving) return;

    setIsSaving(true);
    try {
      await db.products.update(editingProduct.id, {
        name: editName.trim(),
        category: editCategory,
        unit: editUnit,
        buy_price: editBuyPrice,
        retail_price: editRetailPrice,
        wholesale_price: editWholesalePrice,
        min_wholesale_qty: editMinWholesaleQty,
        stock: editStock,
        rack_location: editRackLocation.trim(),
        image_url: editImageUrl.trim() || editingProduct.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
        updated_at: new Date().toISOString()
      });

      setSaveSuccessMsg(`Data produk "${editName}" berhasil diperbarui.`);
      await onProductsUpdated();

      setTimeout(() => {
        setSaveSuccessMsg(null);
        setEditingProduct(null);
      }, 1000);
    } catch (err: any) {
      alert('Gagal memperbarui produk: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (window.confirm(`Hapus produk "${prod.name}" (${prod.id}) dari Master Data?`)) {
      await db.products.delete(prod.id);
      await onProductsUpdated();
    }
  };

  // CSV Import / Export States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Product[]>([]);
  const [importTotalCount, setImportTotalCount] = useState<number>(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // 1. Download CSV Template
  const handleDownloadTemplate = () => {
    const headers = "barcode,name,category,buy_price,retail_price,wholesale_price,min_wholesale_qty,stock,unit,rack_location,min_stock_alert";
    const sampleRows = [
      "8992741910015,Minyak Goreng Bimoli 2L,Sembako,32000,36000,34500,6,24,Pouch,RAK-A1,5",
      "8992741910022,Beras Pandan Wangi 5kg,Sembako,68000,78000,75000,5,15,Sak,RAK-A2,3",
      "8992741910039,Gula Pasir Gulaku 1kg,Sembako,15500,18000,17000,10,50,Kg,RAK-A3,10",
      "089686010924,Indomie Goreng Spesial 85g,Makanan Instan,2800,3500,3100,40,120,Pcs,RAK-B1,20",
      "8991001101234,Kopi Kapal Api Special Mix 10s,Minuman,12000,15000,14000,10,40,Pack,RAK-B2,5"
    ].join("\n");
    const csvContent = `${headers}\n${sampleRows}`;
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Template_Produk_KetokoPOS.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // 2. Export All Current Products to CSV
  const handleExportCSV = () => {
    if (products.length === 0) {
      alert("Belum ada data produk untuk diekspor.");
      return;
    }
    const headers = "id,barcode,name,category,buy_price,retail_price,wholesale_price,min_wholesale_qty,stock,unit,rack_location,min_stock_alert";
    const rows = products.map((p) => {
      const escape = (str: string) => `"${(str || "").replace(/"/g, '""')}"`;
      return [
        escape(p.id),
        escape(p.barcode),
        escape(p.name),
        escape(p.category || "Umum"),
        p.buy_price || 0,
        p.retail_price || 0,
        p.wholesale_price || 0,
        p.min_wholesale_qty || 1,
        p.stock || 0,
        escape(p.unit || "Pcs"),
        escape(p.rack_location || ""),
        p.min_stock_alert || 5
      ].join(",");
    });
    const csvContent = `${headers}\n${rows.join("\n")}`;
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `KetokoPOS_MasterProduk_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 3. Parse and preview uploaded CSV file
  const handleCSVFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccessMsg(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error("File CSV kosong atau hanya berisi baris header.");
      }

      // Auto detect separator (, or ;)
      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());

      const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("nama") || h.includes("barang") || h.includes("produk"));
      const barcodeIdx = headers.findIndex((h) => h.includes("barcode") || h.includes("kode"));
      const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("kategori"));
      const buyPriceIdx = headers.findIndex((h) => h.includes("buy") || h.includes("modal") || h.includes("hpp") || h.includes("beli"));
      const retailPriceIdx = headers.findIndex((h) => h.includes("retail") || h.includes("jual") || h.includes("eceran") || h.includes("price") || h.includes("harga"));
      const wholesaleIdx = headers.findIndex((h) => h.includes("grosir") || h.includes("wholesale"));
      const minWholesaleQtyIdx = headers.findIndex((h) => h.includes("min_wholesale") || h.includes("min_qty") || h.includes("qty_grosir"));
      const stockIdx = headers.findIndex((h) => h.includes("stock") || h.includes("stok") || h.includes("qty") || h.includes("jumlah"));
      const unitIdx = headers.findIndex((h) => h.includes("unit") || h.includes("satuan"));
      const rackIdx = headers.findIndex((h) => h.includes("rack") || h.includes("rak") || h.includes("lokasi"));
      const minStockAlertIdx = headers.findIndex((h) => h.includes("alert") || h.includes("min_stock"));

      const parsed: Product[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ""));
        if (row.length === 0 || !row.some((cell) => cell.length > 0)) continue;

        const name = nameIdx !== -1 ? row[nameIdx] : row[1] || `Item Baris ${i}`;
        if (!name) continue;

        const barcode = barcodeIdx !== -1 ? row[barcodeIdx] : row[0] || "";
        const category = catIdx !== -1 ? row[catIdx] : "Sembako";
        const buy_price = buyPriceIdx !== -1 ? Number(row[buyPriceIdx].replace(/[^\d.-]/g, "")) || 0 : 0;
        const retail_price = retailPriceIdx !== -1 ? Number(row[retailPriceIdx].replace(/[^\d.-]/g, "")) || 0 : 0;
        const wholesale_price = wholesaleIdx !== -1 ? Number(row[wholesaleIdx].replace(/[^\d.-]/g, "")) || 0 : retail_price;
        const min_wholesale_qty = minWholesaleQtyIdx !== -1 ? Number(row[minWholesaleQtyIdx].replace(/[^\d.-]/g, "")) || 1 : 1;
        const stock = stockIdx !== -1 ? Number(row[stockIdx].replace(/[^\d.-]/g, "")) || 0 : 0;
        const unit = unitIdx !== -1 ? row[unitIdx] || "Pcs" : "Pcs";
        const rack_location = rackIdx !== -1 ? row[rackIdx] || "RAK-01" : "RAK-01";
        const min_stock_alert = minStockAlertIdx !== -1 ? Number(row[minStockAlertIdx].replace(/[^\d.-]/g, "")) || 5 : 5;

        parsed.push({
          id: barcode || `PRD-${Date.now()}-${i}`,
          barcode: barcode || `BC-${i}`,
          name: name,
          category: category || "Umum",
          buy_price: buy_price,
          retail_price: retail_price,
          wholesale_price: wholesale_price,
          min_wholesale_qty: min_wholesale_qty,
          stock: stock,
          unit: unit,
          rack_location: rack_location,
          min_stock_alert: min_stock_alert,
          image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
          updated_at: new Date().toISOString()
        });
      }

      if (parsed.length === 0) {
        throw new Error("Tidak ada data produk yang berhasil dibaca dari file CSV.");
      }

      setImportPreview(parsed);
      setImportTotalCount(parsed.length);
    } catch (err: any) {
      setImportError(err.message || "Gagal memproses file CSV.");
      setImportPreview([]);
      setImportTotalCount(0);
    }
  };

  // 4. Execute Import to IndexedDB
  const handleExecuteImport = async () => {
    if (importPreview.length === 0 || isImporting) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const chunkSize = 2000;
      for (let i = 0; i < importPreview.length; i += chunkSize) {
        const chunk = importPreview.slice(i, i + chunkSize);
        await db.products.bulkPut(chunk);
      }

      setImportSuccessMsg(`🎉 Berhasil mengimpor ${importPreview.length.toLocaleString('id-ID')} produk ke toko!`);
      await onProductsUpdated();

      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportPreview([]);
        setImportTotalCount(0);
        setImportSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setImportError("Gagal menyimpan ke database: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Metrics
  const totalSKU = products.length;

  return (
    <div className="flex-1 p-3 sm:p-5 overflow-y-auto bg-[#f6f0ea] space-y-4">
      
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#e5d0be] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-[#faebd7] text-[#96633b] border border-[#eed7c4] shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#3d2617] tracking-tight flex items-center gap-2">
              <span>Master Data : Daftar Item & Harga Barang</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#faebd7] text-[#96633b] border border-[#eed7c4]">
                {totalSKU} SKU
              </span>
            </h1>
            <p className="text-xs text-[#8a6b53] mt-0.5">
              Kelola daftar produk, foto WebP, harga modal beli, harga eceran retail, dan tier harga grosir toko
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto flex-wrap sm:flex-nowrap gap-y-2">
          <button
            onClick={() => {
              setImportPreview([]);
              setImportError(null);
              setImportSuccessMsg(null);
              setIsImportModalOpen(true);
            }}
            className="px-3.5 py-2 bg-[#f0f9ff] hover:bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
            title="Import daftar produk massal dari file CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#0284c7]" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-[#edf5ee] hover:bg-[#dcf0df] text-[#166534] border border-[#cce2cf] rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
            title="Download seluruh daftar produk toko ke file CSV"
          >
            <Download className="w-4 h-4 text-[#166534]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenNewProduct}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Item Baru</span>
          </button>

          <button
            onClick={onGoToPOS}
            className="px-4 py-2 bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] border border-[#ddc3aa] rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-[#96633b]" />
            <span>Ke Kasir POS</span>
            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-[#e5d0be] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#8a6b53] absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama barang, barcode, SKU, rak..."
            className="w-full pl-10 pr-4 py-2 bg-[#fcf9f5] text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b] placeholder:text-[#8a6b53] font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-[#8a6b53] hover:text-[#3d2617]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                    : 'bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            );
          })}
        </div>

      </div>

      {/* 0-Data Onboarding Welcome Banner */}
      {products.length === 0 && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#fbf5ee] to-[#f4e8dc] border-2 border-dashed border-[#ddc3aa] shadow-xs animate-fadeIn">
          <div className="max-w-xl mx-auto text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#96633b] text-amber-100 flex items-center justify-center shadow-md">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#3d2617]">Selamat Datang di Master Data Toko!</h3>
              <p className="text-xs text-[#8a6b53] mt-1 leading-relaxed">
                Aplikasi kasir ini baru dan siap digunakan. Belum ada produk yang terdaftar di database lokal. Silakan pilih metode untuk mulai mengisi barang:
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                onClick={onOpenNewProduct}
                className="px-4 py-2.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Produk Manual</span>
              </button>
              <button
                onClick={() => {
                  setImportPreview([]);
                  setImportError(null);
                  setImportSuccessMsg(null);
                  setIsImportModalOpen(true);
                }}
                className="px-4 py-2.5 bg-[#f0f9ff] hover:bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#0284c7]" />
                <span>📊 Import dari Excel / CSV</span>
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2.5 bg-white hover:bg-[#f5ebe0] text-[#5c3c26] border border-[#ddc3aa] rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-all"
              >
                <Download className="w-4 h-4 text-[#96633b]" />
                <span>📥 Download Template CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Master Table */}
      <div className="bg-white rounded-3xl border border-[#e5d0be] shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#f5ebe0] text-[#5c3c26] font-bold text-[11px] uppercase tracking-wider border-b border-[#e5d0be] z-10">
              <tr>
                <th className="px-4 py-3.5">Produk & Barcode</th>
                <th className="px-3 py-3.5">Kategori & Rak</th>
                <th className="px-3 py-3.5 text-right">Harga Beli (Modal)</th>
                <th className="px-3 py-3.5 text-right">Harga Eceran (Retail)</th>
                <th className="px-3 py-3.5 text-right">Harga Grosir</th>
                <th className="px-3 py-3.5 text-center">Margin %</th>
                <th className="px-3 py-3.5 text-center">Sisa Stok</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2e5d8] font-sans">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#8a6b53]">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#96633b]" />
                    <p className="text-sm font-semibold text-[#3d2617]">Tidak ada data produk yang cocok.</p>
                    <p className="text-xs text-[#8a6b53] mt-0.5">Coba cari dengan kata kunci lain atau tambah item baru.</p>
                  </td>
                </tr>
              ) : (
                pageItems.map((prod) => {
                  const marginPercent = prod.retail_price > 0
                    ? (((prod.retail_price - prod.buy_price) / prod.retail_price) * 100).toFixed(1)
                    : '0';

                  const hasWholesale = prod.wholesale_price < prod.retail_price;

                  return (
                    <tr key={prod.id} className="hover:bg-[#fcf9f5] transition-colors">
                      
                      {/* Product Name, SKU & Barcode */}
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-bold text-[#3d2617] leading-tight text-xs">{prod.name}</div>
                          <div className="font-mono text-[11px] text-[#8a6b53] mt-1 flex items-center gap-1.5">
                            <span className="font-semibold text-[#96633b] bg-[#faebd7] px-1.5 py-0.2 rounded border border-[#eed7c4]">
                              {prod.id}
                            </span>
                            <span>{prod.barcode}</span>
                          </div>
                        </div>
                      </td>

                      {/* Category & Location */}
                      <td className="px-3 py-3">
                        <div className="font-medium text-[#3d2617]">{prod.category}</div>
                        <div className="text-[11px] font-mono text-[#8a6b53]">{prod.rack_location}</div>
                      </td>

                      {/* Buy Price */}
                      <td className="px-3 py-3 text-right font-mono text-[#8a6b53] font-medium">
                        {formatRupiah(prod.buy_price)}
                        <span className="text-[10px] text-[#8a6b53] block font-sans">/{prod.unit}</span>
                      </td>

                      {/* Retail Price */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-[#166534] text-sm">
                        {formatRupiah(prod.retail_price)}
                        <span className="text-[10px] font-normal text-[#8a6b53] block font-sans">/{prod.unit}</span>
                      </td>

                      {/* Wholesale Price */}
                      <td className="px-3 py-3 text-right">
                        {hasWholesale ? (
                          <div>
                            <div className="font-mono font-bold text-[#96633b]">
                              {formatRupiah(prod.wholesale_price)}
                            </div>
                            <span className="text-[10px] font-semibold text-[#96633b] bg-[#faebd7] px-1.5 py-0.5 rounded-full border border-[#eed7c4]">
                              &ge; {prod.min_wholesale_qty} {prod.unit}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#8a6b53] text-[11px]">-</span>
                        )}
                      </td>

                      {/* Margin % */}
                      <td className="px-3 py-3 text-center">
                        <span className="font-mono font-bold text-xs text-[#166534] bg-[#edf5ee] px-2 py-0.5 rounded-full border border-[#cce2cf]">
                          +{marginPercent}%
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="px-3 py-3 text-center font-mono">
                        <span className={`font-bold text-xs ${prod.stock <= prod.min_stock_alert ? 'text-rose-700' : 'text-[#3d2617]'}`}>
                          {prod.stock} {prod.unit}
                        </span>
                        {prod.stock <= prod.min_stock_alert && (
                          <div className="text-[9px] text-rose-700 font-bold uppercase">Stok Tipis</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleStartEdit(prod)}
                            title="Edit Foto & Data Barang"
                            className="p-1.5 rounded-xl bg-[#faebd7] hover:bg-[#f6dfc4] text-[#96633b] border border-[#eed7c4] transition-colors shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteProduct(prod)}
                            title="Hapus Produk"
                            className="p-1.5 rounded-xl bg-[#fbeeed] hover:bg-[#f8dbdb] text-rose-700 border border-[#f4cfcf] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-[#fdfaf7] border-t border-[#e5d0be] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs text-[#8a6b53]">
            Menampilkan <b className="text-[#3d2617]">{filteredProducts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</b> -{' '}
            <b className="text-[#3d2617]">{Math.min(currentPage * pageSize, filteredProducts.length)}</b> dari{' '}
            <b className="text-[#3d2617]">{filteredProducts.length.toLocaleString('id-ID')}</b> total produk
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="Halaman Pertama"
              className="p-1.5 rounded-lg bg-white border border-[#ddc3aa] text-[#5c3c26] hover:bg-[#f5ebe0] disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Halaman Sebelumnya"
              className="p-1.5 rounded-lg bg-white border border-[#ddc3aa] text-[#5c3c26] hover:bg-[#f5ebe0] disabled:opacity-40 disabled:hover:bg-white"
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
              className="p-1.5 rounded-lg bg-white border border-[#ddc3aa] text-[#5c3c26] hover:bg-[#f5ebe0] disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Halaman Terakhir"
              className="p-1.5 rounded-lg bg-white border border-[#ddc3aa] text-[#5c3c26] hover:bg-[#f5ebe0] disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Product & Photo Modal Popup */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Ubah Foto & Data Produk</h3>
                  <p className="text-xs text-[#fcefe3] font-mono">{editingProduct.id} • {editingProduct.barcode}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-5 sm:p-6 space-y-4 text-xs bg-[#fcf9f5] overflow-y-auto">
              
              {/* Photo Upload & WebP Conversion Section */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#e5d0be] shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#3d2617] font-bold text-xs flex items-center">
                    <ImageIcon className="w-4 h-4 mr-1.5 text-[#96633b]" />
                    Foto Produk (Format WebP Otomatis)
                  </span>
                  <span className="text-[10px] text-[#8a6b53] font-medium flex items-center">
                    <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                    Optimal & Cepat
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Image Preview Box */}
                  <div className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-[#ddc3aa] bg-[#fcf9f5] flex items-center justify-center overflow-hidden shrink-0 group">
                    {editImageUrl ? (
                      <>
                        <img 
                          src={editImageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="p-1 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors shadow-xs"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#a08573] p-1 text-center">
                        <ImageIcon className="w-6 h-6 mb-0.5 opacity-50 text-[#96633b]" />
                        <span className="text-[9px]">Tanpa foto</span>
                      </div>
                    )}

                    {isConvertingImage && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white text-[9px] space-y-1">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>WebP...</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Actions */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{editImageUrl ? 'Ganti Foto' : 'Upload Foto'}</span>
                        <input 
                          type="file" 
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp" 
                          onChange={handleImageFileChange} 
                          className="hidden" 
                        />
                      </label>

                      {editImageUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-2.5 py-1.5 bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] rounded-xl text-xs font-bold border border-[#ddc3aa] transition-colors"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    {editImageMeta ? (
                      <div className="text-[10px] text-[#166534] font-bold">
                        ✓ WebP Terkonversi: {editImageMeta.webpSizeKb} KB ({editImageMeta.width}x{editImageMeta.height} px)
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#8a6b53]">
                        Unggah foto produk baru, otomatis dikonversi ke format WebP ringan.
                      </p>
                    )}

                    {imageError && (
                      <p className="text-[10px] text-rose-600 font-semibold">{imageError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="text-[#5c3c26] font-semibold mb-1 block">Nama Produk</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] focus:bg-white focus:border-[#96633b]"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <CustomSelect
                  label="Kategori"
                  value={editCategory}
                  onChange={setEditCategory}
                  options={[
                    'Sembako',
                    'Minuman',
                    'Mie & Makanan Instan',
                    'Perawatan Tubuh',
                    'Kebersihan',
                    'Snack & Biskuit',
                    'Lain-lain'
                  ]}
                />

                <CustomSelect
                  label="Satuan (Unit)"
                  value={editUnit}
                  onChange={setEditUnit}
                  options={[
                    'Pcs',
                    'Pouch',
                    'Sak',
                    'Bks',
                    'Kotak',
                    'Renceng',
                    'Botol'
                  ]}
                />
              </div>

              {/* Prices: Buy, Retail, Wholesale, Min Qty */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-white rounded-2xl border border-[#e5d0be] shadow-xs">
                <div>
                  <label className="text-[#8a6b53] mb-1 block font-medium">Harga Modal Beli (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editBuyPrice}
                    onChange={(e) => setEditBuyPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] font-mono font-semibold rounded-lg border border-[#ddc3aa]"
                  />
                </div>

                <div>
                  <label className="text-[#8a6b53] mb-1 block font-medium">Harga Jual Eceran (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editRetailPrice}
                    onChange={(e) => setEditRetailPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#166534] font-mono font-bold rounded-lg border border-[#ddc3aa]"
                  />
                </div>

                <div>
                  <label className="text-[#8a6b53] mb-1 block font-medium">Harga Grosir (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editWholesalePrice}
                    onChange={(e) => setEditWholesalePrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#96633b] font-mono font-bold rounded-lg border border-[#ddc3aa]"
                  />
                </div>

                <div>
                  <label className="text-[#8a6b53] mb-1 block font-medium">Min. Qty Grosir ({editUnit})</label>
                  <input
                    type="number"
                    min="1"
                    value={editMinWholesaleQty}
                    onChange={(e) => setEditMinWholesaleQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 bg-[#fcf9f5] text-[#3d2617] font-mono font-semibold rounded-lg border border-[#ddc3aa] text-center"
                  />
                </div>
              </div>

              {/* Stock & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#5c3c26] font-semibold mb-1 block">Sisa Stok Fisik</label>
                  <input
                    type="number"
                    min="0"
                    value={editStock}
                    onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono"
                  />
                </div>

                <div>
                  <label className="text-[#5c3c26] font-semibold mb-1 block">Lokasi Rak Gudang</label>
                  <input
                    type="text"
                    value={editRackLocation}
                    onChange={(e) => setEditRackLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] font-mono"
                  />
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-[#edf5ee] border border-[#cce2cf] text-[#166534] text-xs font-semibold flex items-center justify-center space-x-1.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2.5 bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] font-bold rounded-xl border border-[#ddc3aa]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-[#96633b] hover:bg-[#83532e] text-white font-bold rounded-xl shadow-xs transition-all"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c] shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Import Data Produk dari Excel / CSV</h3>
                  <p className="text-xs text-[#fcefe3]">Unggah berkas spreadsheet untuk menambahkan ratusan produk sekaligus</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              
              {/* Step 1: Download Template */}
              <div className="p-4 rounded-2xl bg-white border border-[#e5d0be] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-xs text-[#3d2617] flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#96633b] text-white text-[11px] font-bold flex items-center justify-center">1</span>
                    <span>Download Contoh Format Berkas (Template)</span>
                  </h4>
                  <p className="text-[11px] text-[#8a6b53] mt-0.5">
                    Gunakan template resmi agar nama kolom, format barcode, dan harga terbaca akurat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] border border-[#ddc3aa] rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#96633b]" />
                  <span>Download .CSV</span>
                </button>
              </div>

              {/* Step 2: Upload File Area */}
              <div className="p-5 rounded-2xl bg-white border-2 border-dashed border-[#ddc3aa] text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#faebd7] text-[#96633b] flex items-center justify-center">
                  <FileUp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-[#3d2617]">Pilih Berkas CSV dari Komputer Anda</h4>
                  <p className="text-[11px] text-[#8a6b53] mt-0.5">Format didukung: File CSV (Pemisah Koma atau Titik Koma)</p>
                </div>
                <label className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all">
                  <Upload className="w-4 h-4" />
                  <span>Pilih Berkas CSV...</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCSVFileSelected}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Error Message */}
              {importError && (
                <div className="p-3 bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] rounded-2xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Success Message */}
              {importSuccessMsg && (
                <div className="p-3 bg-[#edf5ee] border border-[#cce2cf] text-[#166534] rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {/* Preview Table */}
              {importPreview.length > 0 && (
                <div className="space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#3d2617]">
                      Ditemukan <span className="text-[#96633b] font-black">{importTotalCount.toLocaleString('id-ID')}</span> produk valid:
                    </span>
                    <span className="text-[11px] text-[#8a6b53]">Menampilkan cuplikan 5 baris pertama</span>
                  </div>

                  <div className="border border-[#e5d0be] rounded-2xl overflow-hidden bg-white max-h-48 overflow-y-auto text-[11px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#f5ebe0] text-[#5c3c26] font-bold sticky top-0 border-b border-[#e5d0be]">
                        <tr>
                          <th className="p-2">Barcode</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2">Kategori</th>
                          <th className="p-2 text-right">Modal</th>
                          <th className="p-2 text-right">Jual</th>
                          <th className="p-2 text-center">Stok</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f2e5d8]">
                        {importPreview.slice(0, 5).map((p, idx) => (
                          <tr key={idx} className="hover:bg-[#fcf9f5]">
                            <td className="p-2 font-mono text-[#8a6b53]">{p.barcode || p.id}</td>
                            <td className="p-2 font-semibold text-[#3d2617]">{p.name}</td>
                            <td className="p-2 text-[#8a6b53]">{p.category}</td>
                            <td className="p-2 text-right text-[#8a6b53]">{formatRupiah(p.buy_price)}</td>
                            <td className="p-2 text-right font-bold text-[#166534]">{formatRupiah(p.retail_price)}</td>
                            <td className="p-2 text-center font-bold text-[#3d2617]">{p.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#e5d0be] bg-[#f5ebe0] flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-[#ebd7c5] text-[#5c3c26] rounded-xl text-xs font-bold border border-[#ddc3aa] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importPreview.length === 0 || isImporting}
                className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>{isImporting ? 'Mengimpor Data...' : `Impor ${importTotalCount > 0 ? `${importTotalCount.toLocaleString('id-ID')} Produk` : 'Sekarang'}`}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
});
