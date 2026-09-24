import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Printer, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Flame, 
  Receipt, 
  Search, 
  Building2, 
  Calculator,
  AlertTriangle,
  Boxes,
  Coins,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { db } from '../db';
import type { Transaction, Product, TransactionItem, OperationalExpense, StoreProfile } from '../types';
import { exportReportToPDF } from '../services/pdfReportService';
import { FileSpreadsheet } from 'lucide-react';
import { formatRupiah, ESCPOSBuilder, printToWebSerial } from '../services/escposService';
import { syncService } from '../services/syncService';

interface FullReportsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'sales' | 'products' | 'profit' | 'inventory' | 'payment';
  userRole?: 'SUPERADMIN' | 'ADMIN' | 'CASHIER' | 'MANAGER';
  cashierName?: string;
  branchId?: string;
}

// Default initial operational expenses (clean 0-data state)
const INITIAL_EXPENSES: OperationalExpense[] = [];

export const FullReportsCenterModal: React.FC<FullReportsCenterModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'sales',
  userRole = 'ADMIN',
  cashierName = 'Kasir Toko',
  branchId = 'BR-01'
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'profit' | 'inventory' | 'payment'>(initialTab);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('all');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('ALL');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'ALL' | 'CRITICAL'>('ALL');
  const [paymentFilterMethod, setPaymentFilterMethod] = useState<'ALL' | 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER'>('ALL');

  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  // Operational Expenses for Detailed Profit & Loss Statement
  const [expenses] = useState<OperationalExpense[]>(() => {
    const saved = localStorage.getItem('ketoko_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'MANAGER';
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadReportData(true);
    }
  }, [isOpen, initialTab]);

  const loadReportData = async (syncCloud = false) => {
    try {
      // 1. Ambil data lokal seketika (instant 0ms)
      const allTrx = await db.transactions.toArray();
      const allProducts = await db.products.toArray();
      setTransactions(allTrx);
      setProducts(allProducts);

      // 2. Tarik update transaksi terbaru dari Supabase Cloud di background
      if (syncCloud && navigator.onLine) {
        setIsRefreshing(true);
        try {
          await syncService.pullTransactionsFromSupabase(500);
          const freshTrx = await db.transactions.toArray();
          setTransactions(freshTrx);
        } catch (err) {
          console.warn('[FullReports] Cloud pull deferred:', err);
        } finally {
          setIsRefreshing(false);
        }
      }
    } catch (err) {
      console.error('[FullReports] Gagal load report data:', err);
    }
  };

  // Real-time synchronization listeners: Perbarui angka laporan secara otomatis jika ada transaksi masuk/dihapus
  useEffect(() => {
    if (!isOpen) return;

    const handleTrxCreated = (e: any) => {
      const trx = e.detail?.transaction;
      if (trx && trx.id) {
        setTransactions((prev) => {
          if (prev.some((t) => t.id === trx.id)) return prev;
          return [trx, ...prev];
        });
      }
    };

    const handleTrxDeleted = (e: any) => {
      const id = e.detail?.id;
      if (id) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      }
    };

    const handleTrxRefreshed = async () => {
      const allTrx = await db.transactions.toArray();
      setTransactions(allTrx);
    };

    const handleProductUpdated = (e: any) => {
      const prod = e.detail?.product || e.detail;
      if (prod && prod.id) {
        setProducts((prev) => {
          const idx = prev.findIndex((p) => p.id === prod.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...prod };
            return copy;
          }
          return [prod, ...prev];
        });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadReportData(true);
      }
    };

    window.addEventListener('ketoko_transaction_created', handleTrxCreated);
    window.addEventListener('ketoko_transaction_deleted', handleTrxDeleted);
    window.addEventListener('ketoko_transactions_refreshed', handleTrxRefreshed);
    window.addEventListener('ketoko_product_updated', handleProductUpdated);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('ketoko_transaction_created', handleTrxCreated);
      window.removeEventListener('ketoko_transaction_deleted', handleTrxDeleted);
      window.removeEventListener('ketoko_transactions_refreshed', handleTrxRefreshed);
      window.removeEventListener('ketoko_product_updated', handleProductUpdated);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOpen]);

  // Product Map for fast O(1) lookups
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Filter transactions based on active Date Preset
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return transactions.filter((t) => {
      const tDate = new Date(t.created_at);
      if (dateFilter === 'today') {
        return tDate >= today;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return tDate >= sevenDaysAgo;
      } else if (dateFilter === 'month') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return tDate >= firstDayOfMonth;
      } else if (dateFilter === 'custom') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return tDate >= start && tDate <= end;
      }
      return true; // 'all'
    });
  }, [transactions, dateFilter, startDate, endDate]);

  // Filter expenses based on active Date Preset
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return expenses.filter((e) => {
      const eDate = new Date(e.date);
      if (dateFilter === 'today') {
        return eDate >= today;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return eDate >= sevenDaysAgo;
      } else if (dateFilter === 'month') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return eDate >= firstDayOfMonth;
      } else if (dateFilter === 'custom') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return eDate >= start && eDate <= end;
      }
      return true;
    });
  }, [expenses, dateFilter, startDate, endDate]);

  // Comprehensive Metrics Calculation
  const metrics = useMemo(() => {
    let totalGrossRevenue = 0;
    let totalDiscount = 0;
    let totalNetRevenue = 0;
    let totalTax = 0;
    let totalItems = 0;
    let totalCOGS = 0; // Cost of Goods Sold (Harga Pokok Penjualan)

    const paymentMethodMap: Record<string, number> = {
      CASH: 0,
      QRIS: 0,
      DEBIT: 0,
      TRANSFER: 0
    };

    const productSalesMap = new Map<string, { product: Product; qty: number; totalSales: number; totalCost: number }>();
    const categorySalesMap = new Map<string, { qty: number; totalSales: number; totalCost: number }>();

    filteredTransactions.forEach((trx) => {
      totalGrossRevenue += trx.subtotal;
      totalDiscount += trx.discount_amount || 0;
      totalNetRevenue += trx.grand_total;
      totalTax += trx.tax_amount || 0;

      const pMethod = trx.payment_method || 'CASH';
      paymentMethodMap[pMethod] = (paymentMethodMap[pMethod] || 0) + trx.grand_total;

      trx.items.forEach((item: TransactionItem) => {
        totalItems += item.qty;
        const prod = productMap.get(item.product_id);
        const buyPrice = prod ? prod.buy_price : item.buy_price || item.price_applied * 0.7;
        const itemCOGS = buyPrice * item.qty;
        totalCOGS += itemCOGS;

        // Product ranking
        const curProd = productSalesMap.get(item.product_id) || {
          product: prod || ({
            id: item.product_id,
            barcode: '-',
            name: item.product_name,
            category: 'Umum',
            buy_price: buyPrice,
            retail_price: item.price_applied,
            wholesale_price: item.price_applied,
            min_wholesale_qty: 10,
            stock: 0,
            unit: 'pcs',
            rack_location: 'Rak',
            min_stock_alert: 5
          } as Product),
          qty: 0,
          totalSales: 0,
          totalCost: 0
        };
        curProd.qty += item.qty;
        curProd.totalSales += item.subtotal_item;
        curProd.totalCost += itemCOGS;
        productSalesMap.set(item.product_id, curProd);

        // Category ranking
        const cat = prod?.category || 'Umum';
        const curCat = categorySalesMap.get(cat) || { qty: 0, totalSales: 0, totalCost: 0 };
        curCat.qty += item.qty;
        curCat.totalSales += item.subtotal_item;
        curCat.totalCost += itemCOGS;
        categorySalesMap.set(cat, curCat);
      });
    });

    const grossProfit = totalNetRevenue - totalCOGS;
    const grossProfitMarginPercent = totalNetRevenue > 0 ? (grossProfit / totalNetRevenue) * 100 : 0;

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const netProfitMarginPercent = totalNetRevenue > 0 ? (netProfit / totalNetRevenue) * 100 : 0;

    // Ranked best sellers
    const rankedProducts = Array.from(productSalesMap.values()).sort((a, b) => b.qty - a.qty);

    // Ranked categories
    const rankedCategories = Array.from(categorySalesMap.entries()).map(([cat, data]) => ({
      category: cat,
      ...data,
      profit: data.totalSales - data.totalCost,
      margin: data.totalSales > 0 ? ((data.totalSales - data.totalCost) / data.totalSales) * 100 : 0
    })).sort((a, b) => b.totalSales - a.totalSales);

    // Fast Category Set and Inventory Assets in single loop
    const categorySet = new Set<string>();
    let totalStockQty = 0;
    let totalInventoryAssetValue = 0;
    let totalRetailAssetValue = 0;
    let criticalStockCount = 0;

    products.forEach((p) => {
      totalStockQty += p.stock;
      totalInventoryAssetValue += p.stock * p.buy_price;
      totalRetailAssetValue += p.stock * p.retail_price;
      if (p.stock <= p.min_stock_alert) {
        criticalStockCount++;
      }
      if (p.category) categorySet.add(p.category);
    });

    const allCategories = ['ALL', ...Array.from(categorySet)];

    return {
      totalTrx: filteredTransactions.length,
      totalGrossRevenue,
      totalDiscount,
      totalNetRevenue,
      totalTax,
      totalItems,
      totalCOGS,
      grossProfit,
      grossProfitMarginPercent,
      totalExpenses,
      netProfit,
      netProfitMarginPercent,
      paymentMethodMap,
      rankedProducts,
      rankedCategories,
      allCategories,
      totalStockQty,
      totalInventoryAssetValue,
      totalRetailAssetValue,
      criticalStockCount
    };
  }, [filteredTransactions, filteredExpenses, productMap, products]);

  // Inventory Table Pagination
  const [inventoryPage, setInventoryPage] = useState(1);
  const INVENTORY_PAGE_SIZE = 50;

  const filteredInventoryProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return products.filter((p: Product) => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.barcode.includes(q);
      const matchCritical = inventoryStockFilter === 'ALL' || p.stock <= p.min_stock_alert;
      return matchSearch && matchCritical;
    });
  }, [products, searchTerm, inventoryStockFilter]);

  const paginatedInventoryProducts = useMemo(() => {
    const start = (inventoryPage - 1) * INVENTORY_PAGE_SIZE;
    return filteredInventoryProducts.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [filteredInventoryProducts, inventoryPage]);

  const inventoryTotalPages = Math.ceil(filteredInventoryProducts.length / INVENTORY_PAGE_SIZE) || 1;

  // Reset pagination when search or filter changes
  useEffect(() => {
    setInventoryPage(1);
  }, [searchTerm, inventoryStockFilter]);


  // Export active report to A4 PDF with Official Letterhead
  const handleExportPDF = () => {
    const savedStore = localStorage.getItem('ketoko_store_profile');
    const storeProfile: StoreProfile | undefined = savedStore ? JSON.parse(savedStore) : undefined;
    const periodLabel = dateFilter === 'custom' ? `${startDate} s/d ${endDate}` : dateFilter === 'today' ? 'Hari Ini (' + new Date().toLocaleDateString('id-ID') + ')' : dateFilter === '7days' ? '7 Hari Terakhir' : dateFilter === 'month' ? 'Bulan Ini (' + new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }) + ')' : 'Seluruh Waktu';

    if (activeTab === 'sales') {
      exportReportToPDF({
        title: 'LAPORAN REKAPITULASI PENJUALAN & SHIFT KASIR',
        periodText: periodLabel,
        storeProfile,
        kpis: [
          { label: 'Penjualan Kotor', value: formatRupiah(metrics.totalGrossRevenue) },
          { label: 'Total Diskon', value: '-' + formatRupiah(metrics.totalDiscount) },
          { label: 'Penjualan Bersih', value: formatRupiah(metrics.totalNetRevenue), highlight: true },
          { label: 'Total Transaksi', value: `${filteredTransactions.length} Struk` }
        ],
        table: {
          headers: ['No. Nota', 'Waktu Transaksi', 'Kasir / Petugas', 'Metode', 'Item', 'Subtotal', 'Diskon', 'Total Bayar'],
          rows: filteredTransactions.map((t) => [
            t.receipt_number,
            new Date(t.created_at).toLocaleString('id-ID'),
            t.cashier_name || cashierName,
            t.payment_method,
            t.items.reduce((s, it) => s + it.qty, 0),
            formatRupiah(t.subtotal),
            '-' + formatRupiah(t.discount_amount || 0),
            formatRupiah(t.grand_total)
          ]),
          alignments: ['left', 'left', 'left', 'center', 'center', 'right', 'right', 'right'],
          footers: ['TOTAL PENJUALAN', '', '', '', `${metrics.totalItems} Pcs`, formatRupiah(metrics.totalGrossRevenue), '-' + formatRupiah(metrics.totalDiscount), formatRupiah(metrics.totalNetRevenue)]
        },
        notes: 'Data laporan penjualan resmi divalidasi dari sistem database offline POS.'
      });
    } else if (activeTab === 'profit') {
      exportReportToPDF({
        title: 'LAPORAN LABA RUGI KOMPREHENSIF (P&L STATEMENT)',
        periodText: periodLabel,
        storeProfile,
        kpis: [
          { label: 'Penjualan Bersih', value: formatRupiah(metrics.totalNetRevenue) },
          { label: 'Total HPP Modal', value: formatRupiah(metrics.totalCOGS) },
          { label: 'Laba Kotor Usaha', value: `${formatRupiah(metrics.grossProfit)} (${metrics.grossProfitMarginPercent.toFixed(1)}%)` },
          { label: 'Laba Bersih Operasional', value: `${formatRupiah(metrics.netProfit)} (${metrics.netProfitMarginPercent.toFixed(1)}%)`, highlight: true }
        ],
        table: {
          headers: ['Komponen Keuangan', 'Kategori Akun', 'Persentase (%)', 'Jumlah Nominal (Rp)'],
          rows: [
            ['1. Pendapatan Kotor Penjualan', 'Penjualan Retail', '100.0%', formatRupiah(metrics.totalGrossRevenue)],
            ['2. Potongan Diskon & Promo', 'Diskon Kasir', `${(metrics.totalGrossRevenue > 0 ? (metrics.totalDiscount / metrics.totalGrossRevenue) * 100 : 0).toFixed(1)}%`, '-' + formatRupiah(metrics.totalDiscount)],
            ['3. Penjualan Bersih (Net Sales)', 'Pendapatan Bersih', '100.0%', formatRupiah(metrics.totalNetRevenue)],
            ['4. Total Beban Pokok Penjualan (HPP)', 'Modal Beli Produk', `${(metrics.totalNetRevenue > 0 ? (metrics.totalCOGS / metrics.totalNetRevenue) * 100 : 0).toFixed(1)}%`, '-' + formatRupiah(metrics.totalCOGS)],
            ['5. Laba Kotor (Gross Profit)', 'Margin Kotor', `${metrics.grossProfitMarginPercent.toFixed(1)}%`, formatRupiah(metrics.grossProfit)],
            ...filteredExpenses.map((exp) => [
              `6. Beban Operasional: ${exp.title}`,
              exp.category,
              `${(metrics.totalNetRevenue > 0 ? (exp.amount / metrics.totalNetRevenue) * 100 : 0).toFixed(1)}%`,
              '-' + formatRupiah(exp.amount)
            ]),
            ['7. Total Beban Operasional Toko', 'Beban Toko', `${(metrics.totalNetRevenue > 0 ? (metrics.totalExpenses / metrics.totalNetRevenue) * 100 : 0).toFixed(1)}%`, '-' + formatRupiah(metrics.totalExpenses)]
          ],
          alignments: ['left', 'left', 'center', 'right'],
          footers: ['LABA BERSIH OPERASIONAL (NET PROFIT)', 'HASIL BERSIH AKHIR', `${metrics.netProfitMarginPercent.toFixed(1)}%`, formatRupiah(metrics.netProfit)]
        },
        notes: 'Laporan Laba Rugi dihitung secara akurat berdasarkan HPP transaksi dan pencatatan beban operasional toko.'
      });
    } else if (activeTab === 'products') {
      exportReportToPDF({
        title: 'LAPORAN PENJUALAN PER PRODUK & SKU',
        periodText: periodLabel,
        storeProfile,
        kpis: [
          { label: 'Total Produk Terjual', value: `${metrics.rankedProducts.length} Jenis Produk` },
          { label: 'Total Unit Keluar', value: `${metrics.totalItems} Pcs` },
          { label: 'Total Omset Produk', value: formatRupiah(metrics.totalGrossRevenue), highlight: true },
          { label: 'Laba Kotor Produk', value: formatRupiah(metrics.grossProfit) }
        ],
        table: {
          headers: ['No', 'Kode SKU', 'Nama Produk / Barang', 'Kategori', 'Qty Terjual', 'Omset Penjualan', 'Laba Kotor'],
          rows: metrics.rankedProducts.map((p, idx) => [
            idx + 1,
            p.product.id,
            p.product.name,
            p.product.category || 'Umum',
            `${p.qty} ${p.product.unit || 'pcs'}`,
            formatRupiah(p.totalSales),
            formatRupiah(p.totalSales - p.totalCost)
          ]),
          alignments: ['center', 'left', 'left', 'left', 'center', 'right', 'right'],
          footers: ['TOTAL', '', `${metrics.rankedProducts.length} Produk`, '', `${metrics.totalItems} Pcs`, formatRupiah(metrics.totalGrossRevenue), formatRupiah(metrics.grossProfit)]
        }
      });
    } else if (activeTab === 'inventory') {
      exportReportToPDF({
        title: 'LAPORAN VALUASI NILAI STOK & ASET INVENTORI',
        periodText: 'Posisi Per ' + new Date().toLocaleString('id-ID'),
        storeProfile,
        kpis: [
          { label: 'Total Jenis Barang (SKU)', value: `${filteredInventoryProducts.length} SKU` },
          { label: 'Total Fisik Barang', value: `${metrics.totalStockQty} Unit/Pcs` },
          { label: 'Total Nilai Aset (HPP Modal)', value: formatRupiah(metrics.totalInventoryAssetValue), highlight: true },
          { label: 'Potensi Omset Retail', value: formatRupiah(metrics.totalRetailAssetValue) }
        ],
        table: {
          headers: ['No', 'Kode SKU', 'Nama Produk / Barang', 'Kategori', 'Stok', 'Harga Beli (HPP)', 'Harga Jual', 'Nilai Aset (HPP)', 'Status'],
          rows: filteredInventoryProducts.map((p, idx) => [
            idx + 1,
            p.id,
            p.name,
            p.category,
            `${p.stock} ${p.unit || 'pcs'}`,
            formatRupiah(p.buy_price),
            formatRupiah(p.retail_price),
            formatRupiah(p.stock * p.buy_price),
            p.stock <= 0 ? 'HABIS' : p.stock <= p.min_stock_alert ? 'MENIPIS' : 'AMAN'
          ]),
          alignments: ['center', 'left', 'left', 'left', 'center', 'right', 'right', 'right', 'center'],
          footers: ['TOTAL ASET', '', `${filteredInventoryProducts.length} SKU`, '', `${metrics.totalStockQty} Pcs`, '', '', formatRupiah(metrics.totalInventoryAssetValue), '']
        }
      });
    } else if (activeTab === 'payment') {
      exportReportToPDF({
        title: 'LAPORAN REKAPITULASI METODE PEMBAYARAN & SETTLEMENT',
        periodText: periodLabel,
        storeProfile,
        kpis: [
          { label: 'Total Pembayaran', value: formatRupiah(metrics.totalNetRevenue), highlight: true },
          { label: 'Total Tunai (Cash)', value: formatRupiah(metrics.paymentMethodMap['CASH'] || 0) },
          { label: 'Total QRIS Digital', value: formatRupiah(metrics.paymentMethodMap['QRIS'] || 0) },
          { label: 'Total EDC / Debit', value: formatRupiah(metrics.paymentMethodMap['DEBIT'] || 0) }
        ],
        table: {
          headers: ['No', 'Metode Pembayaran', 'Total Penerimaan Kasir (Rp)', 'Porsi Kontribusi (%)'],
          rows: Object.entries(metrics.paymentMethodMap).map(([method, amount], idx) => [
            idx + 1,
            method === 'CASH' ? 'Tunai (Cash Physical)' : method === 'QRIS' ? 'QRIS Digital Settlement' : method === 'DEBIT' ? 'Kartu Debit / EDC' : method === 'TRANSFER' ? 'Transfer Bank Direct' : method,
            formatRupiah(amount),
            `${(metrics.totalNetRevenue > 0 ? (amount / metrics.totalNetRevenue) * 100 : 0).toFixed(1)}%`
          ]),
          alignments: ['center', 'left', 'right', 'center'],
          footers: ['TOTAL SETTLEMENT', 'SEMUA SALURAN PEMBAYARAN', formatRupiah(metrics.totalNetRevenue), '100.0%']
        }
      });
    }
  };

  // Export active report to CSV
  const handleExportCSV = () => {
    let filename = `laporan-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'sales') {
      csvContent += 'No Nota,Waktu,Kasir,Metode,Subtotal,Diskon,Pajak,Total\n';
      filteredTransactions.forEach((t) => {
        csvContent += `"${t.receipt_number}","${t.created_at}","${t.cashier_name || cashierName}","${t.payment_method}",${t.subtotal},${t.discount_amount || 0},${t.tax_amount || 0},${t.grand_total}\n`;
      });
    } else if (activeTab === 'products') {
      csvContent += 'Kode SKU,Nama Produk,Kategori,Qty Terjual,Omset Penjualan,Laba Kotor\n';
      metrics.rankedProducts.forEach((p) => {
        csvContent += `"${p.product.id}","${p.product.name}","${p.product.category || 'Umum'}",${p.qty},${p.totalSales},${p.totalSales - p.totalCost}\n`;
      });
    } else if (activeTab === 'inventory') {
      csvContent += 'Kode SKU,Nama Produk,Kategori,Stok,Satuan,Harga Beli HPP,Harga Jual Eceran,Nilai Aset HPP\n';
      filteredInventoryProducts.forEach((p) => {
        csvContent += `"${p.id}","${p.name}","${p.category}",${p.stock},"${p.unit || 'pcs'}",${p.buy_price},${p.retail_price},${p.stock * p.buy_price}\n`;
      });
    } else {
      csvContent += 'Metode Pembayaran,Total Penerimaan\n';
      Object.entries(metrics.paymentMethodMap).forEach(([k, v]) => {
        csvContent += `"${k}",${v}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Thermal Print Handler for Detailed Profit & Loss Report
  const handlePrintThermalReport = async () => {
    setIsPrinting(true);
    setPrintStatus('Mengirim Laporan Laba Rugi Detail ke printer thermal...');

    const periodLabel = dateFilter === 'custom' ? `${startDate} s/d ${endDate}` : dateFilter.toUpperCase();

    const builder = new ESCPOSBuilder();
    builder
      .alignCenter()
      .bold(true)
      .addLine('=== LAPORAN LABA RUGI DETAIL ===')
      .bold(false)
      .addLine(`Cabang: ${branchId} | Petugas: ${cashierName}`)
      .addLine(`Periode: ${periodLabel} | Waktu: ${new Date().toLocaleString('id-ID')}`)
      .addLine('--------------------------------')
      .alignLeft()
      .bold(true)
      .addLine('1. PENDAPATAN PENJUALAN:')
      .bold(false)
      .addLine(`- Penjualan Kotor : ${formatRupiah(metrics.totalGrossRevenue)}`)
      .addLine(`- Potongan Diskon : -${formatRupiah(metrics.totalDiscount)}`)
      .bold(true)
      .addLine(`- PENJUALAN BERSIH: ${formatRupiah(metrics.totalNetRevenue)}`)
      .bold(false)
      .addLine('--------------------------------')
      .bold(true)
      .addLine('2. HARGA POKOK PENJUALAN (HPP):')
      .bold(false)
      .addLine(`- Modal Beli (HPP): ${formatRupiah(metrics.totalCOGS)}`)
      .bold(true)
      .addLine(`- LABA KOTOR      : ${formatRupiah(metrics.grossProfit)} (${metrics.grossProfitMarginPercent.toFixed(1)}%)`)
      .bold(false)
      .addLine('--------------------------------')
      .bold(true)
      .addLine('3. BEBAN OPERASIONAL TOKO:')
      .bold(false);

    filteredExpenses.forEach((exp) => {
      builder.addLine(`- ${exp.title.slice(0, 16).padEnd(16)}: ${formatRupiah(exp.amount)}`);
    });

    builder
      .addLine(`- Total Beban     : ${formatRupiah(metrics.totalExpenses)}`)
      .addLine('================================')
      .bold(true)
      .addLine(`LABA BERSIH USAHA : ${formatRupiah(metrics.netProfit)}`)
      .addLine(`Margin Bersih     : ${metrics.netProfitMarginPercent.toFixed(1)}%`)
      .bold(false)
      .addLine('================================')
      .alignCenter()
      .addLine('Dicetak dari Sistem Resmi KetokoPOS')
      .cut();

    const bytes = builder.getUint8Array();
    const res = await printToWebSerial(bytes);
    setPrintStatus(res.message);
    setIsPrinting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/50 backdrop-blur-xs animate-smooth-backdrop">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-smooth-modal">
        
        {/* 1. Modal Header - Luxury Coffee & Warm Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#5e3519] bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#543017] text-amber-200 shadow-inner border border-[#9b663b]/50">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="font-black text-lg leading-tight tracking-tight text-white">
                  Pusat Laporan & Analitik Retail
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#543017] text-amber-100 uppercase border border-[#9b663b]/50 tracking-wider shadow-2xs">
                  {isAdmin ? 'Akses Penuh (Admin)' : 'Laporan Kasir'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 flex items-center shrink-0 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                  Realtime Live
                </span>
              </div>
              <p className="text-xs text-[#fcefe3]/90 font-medium mt-0.5">
                Rekapitulasi laba rugi komprehensif, penjualan, margin HPP, persediaan, dan beban operasional
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Manual Refresh & Sync Cloud Button */}
            <button
              onClick={() => loadReportData(true)}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-[#543017] hover:bg-[#422511] text-amber-100 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs active:scale-95 border border-[#9b663b]/50 whitespace-nowrap disabled:opacity-50"
              title="Perbarui data laporan dari Cloud & Database secara realtime"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-200 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Sinkron...' : 'Refresh'}</span>
            </button>

            {/* Export PDF A4 Button */}
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#faebd7] text-[#6f4021] text-xs font-black flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 border border-white/30 whitespace-nowrap"
              title="Ekspor Laporan Aktif ke Dokumen PDF (A4 Kop Surat Resmi)"
            >
              <FileText className="w-4 h-4 text-[#6f4021]" />
              <span>Export PDF (A4)</span>
            </button>

            {/* Export CSV / Excel Button */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl bg-[#543017] hover:bg-[#422511] text-amber-100 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs active:scale-95 border border-[#9b663b]/50 whitespace-nowrap"
              title="Unduh Data Mentah Laporan dalam Format Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-200" />
              <span className="hidden md:inline">Export CSV</span>
            </button>

            {/* Thermal Print Button */}
            <button
              onClick={handlePrintThermalReport}
              disabled={isPrinting}
              className="px-3 py-2 rounded-xl bg-[#543017] hover:bg-[#422511] text-amber-100 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs active:scale-95 border border-[#9b663b]/50 whitespace-nowrap"
              title="Cetak Laporan Lengkap ke Printer Thermal ESC/POS"
            >
              <Printer className="w-4 h-4 text-amber-200" />
              <span className="hidden lg:inline">Struk Thermal</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#543017] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Responsive Tab & Date Range Selector - Warm Foam Bar */}
        <div className="px-4 py-2.5 border-b border-[#e4d5c7] bg-[#f5ece3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          
          {/* Tab Navigation Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center space-x-1.5 shadow-2xs active:scale-95 ${
                activeTab === 'sales'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#faebd7] border-[#dfcebe]'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Penjualan & Shift</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('profit')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center space-x-1.5 shadow-2xs active:scale-95 ${
                  activeTab === 'profit'
                    ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                    : 'bg-white text-[#543c2e] hover:bg-[#faebd7] border-[#dfcebe]'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Laba Rugi Detail</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('products')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center space-x-1.5 shadow-2xs active:scale-95 ${
                activeTab === 'products'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#faebd7] border-[#dfcebe]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Produk Terlaris</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center space-x-1.5 shadow-2xs active:scale-95 ${
                  activeTab === 'inventory'
                    ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                    : 'bg-white text-[#543c2e] hover:bg-[#faebd7] border-[#dfcebe]'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Aset Persediaan</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('payment')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center space-x-1.5 shadow-2xs active:scale-95 ${
                activeTab === 'payment'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#faebd7] border-[#dfcebe]'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Metode Pembayaran</span>
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center space-x-1 bg-white/80 p-1 rounded-xl border border-[#dfcebe] text-xs font-bold self-start sm:self-auto shadow-2xs">
            <span className="text-[#856b59] px-2 flex items-center space-x-1 text-[11px]">
              <Calendar className="w-3 h-3 text-[#7c4e2f]" />
              <span>Periode:</span>
            </span>

            <button
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                dateFilter === 'today' ? 'bg-[#7c4e2f] text-white shadow-2xs' : 'text-[#543c2e] hover:bg-[#ebdccf]'
              }`}
            >
              Hari Ini
            </button>

            <button
              onClick={() => setDateFilter('7days')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                dateFilter === '7days' ? 'bg-[#7c4e2f] text-white shadow-2xs' : 'text-[#543c2e] hover:bg-[#ebdccf]'
              }`}
            >
              7 Hari
            </button>

            <button
              onClick={() => setDateFilter('month')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                dateFilter === 'month' ? 'bg-[#7c4e2f] text-white shadow-2xs' : 'text-[#543c2e] hover:bg-[#ebdccf]'
              }`}
            >
              Bulan Ini
            </button>

            <button
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                dateFilter === 'all' ? 'bg-[#7c4e2f] text-white shadow-2xs' : 'text-[#543c2e] hover:bg-[#ebdccf]'
              }`}
            >
              Semua
            </button>

            <button
              onClick={() => setDateFilter('custom')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                dateFilter === 'custom' ? 'bg-[#7c4e2f] text-white shadow-2xs' : 'text-[#543c2e] hover:bg-[#ebdccf]'
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        {/* Date Filter Bar for Custom Dates */}
        {dateFilter === 'custom' && (
          <div className="px-6 py-2 bg-[#faebd7] border-b border-[#e5d0be] flex items-center space-x-3 text-xs animate-fadeIn">
            <span className="font-bold text-[#543c2e]">Rentang Tanggal Khusus:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-[#dfcebe] bg-white font-medium text-xs focus:border-[#7c4e2f]"
            />
            <span className="text-[#856b59]">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-[#dfcebe] bg-white font-medium text-xs focus:border-[#7c4e2f]"
            />
          </div>
        )}

        {/* Print status toast banner */}
        {printStatus && (
          <div className="px-4 py-2 bg-[#faebd7] border-b border-[#ebdccf] text-[#7c4e2f] text-xs font-bold flex items-center justify-between animate-fadeIn">
            <span>{printStatus}</span>
            <button onClick={() => setPrintStatus(null)} className="text-[#7c4e2f] hover:underline">Tutup</button>
          </div>
        )}

        {/* 3. Modal Body: Tab Content Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-[#fcf9f5]">
          
          {/* TAB 1: PENJUALAN & SHIFT */}
          {activeTab === 'sales' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 4 Bento KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#856b59] mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider">Penjualan Bersih</span>
                    <div className="p-1.5 rounded-xl bg-[#faebd7] text-[#7c4e2f]">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#332219]">
                    {formatRupiah(metrics.totalNetRevenue)}
                  </div>
                  <div className="text-[11px] text-[#856b59] mt-2 flex items-center justify-between pt-2 border-t border-[#f0e4d7]">
                    <span>{metrics.totalTrx} Transaksi</span>
                    <span className="font-semibold text-[#166534]">{metrics.totalItems.toLocaleString('id-ID')} Pcs Terjual</span>
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#856b59] mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider">Penjualan Kotor</span>
                    <div className="p-1.5 rounded-xl bg-[#f5ece3] text-[#543c2e]">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#543c2e]">
                    {formatRupiah(metrics.totalGrossRevenue)}
                  </div>
                  <div className="text-[11px] text-[#856b59] mt-2 flex items-center justify-between pt-2 border-t border-[#f0e4d7]">
                    <span>Diskon Toko:</span>
                    <span className="font-bold text-rose-700">-{formatRupiah(metrics.totalDiscount)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#856b59] mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider">Estimasi Laba Kotor</span>
                    <div className="p-1.5 rounded-xl bg-[#edf5ee] text-[#166534]">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#166534]">
                    {formatRupiah(metrics.grossProfit)}
                  </div>
                  <div className="text-[11px] text-[#856b59] mt-2 flex items-center justify-between pt-2 border-t border-[#f0e4d7]">
                    <span>Margin Kotor:</span>
                    <span className="font-black text-[#166534]">{metrics.grossProfitMarginPercent.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#856b59] mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider">Rata-Rata Keranjang (AOV)</span>
                    <div className="p-1.5 rounded-xl bg-[#faebd7] text-[#8c5e3c]">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#8c5e3c]">
                    {formatRupiah(metrics.totalTrx > 0 ? metrics.totalNetRevenue / metrics.totalTrx : 0)}
                  </div>
                  <div className="text-[11px] text-[#856b59] mt-2 flex items-center justify-between pt-2 border-t border-[#f0e4d7]">
                    <span>Pajak (PB1/PPN):</span>
                    <span className="font-semibold text-[#543c2e]">{formatRupiah(metrics.totalTax)}</span>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-[#332219]">Daftar Transaksi Kasir Terakhir</h4>
                  <span className="text-xs text-[#856b59] font-medium">{filteredTransactions.length} Transaksi Ditemukan</span>
                </div>

                <div className="overflow-x-auto max-h-[350px] border border-[#f0e4d7] rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">No. Struk</th>
                        <th className="py-3 px-4">Kasir / Cabang</th>
                        <th className="py-3 px-4">Metode</th>
                        <th className="py-3 px-4 text-right">Item</th>
                        <th className="py-3 px-4 text-right">Total Transaksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {filteredTransactions.slice(0, 40).map((trx) => (
                        <tr key={trx.id} className="hover:bg-[#fcf8f4] transition-colors">
                          <td className="py-2.5 px-4 text-[#856b59] whitespace-nowrap font-mono text-[11px]">
                            {new Date(trx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-[#332219] whitespace-nowrap">
                            {trx.receipt_number}
                          </td>
                          <td className="py-2.5 px-4 text-[#543c2e] whitespace-nowrap">{trx.cashier_name || 'Kasir'}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#faebd7] text-[#7c4e2f] border border-[#eed7c4]">
                              {trx.payment_method}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-[#543c2e] whitespace-nowrap">
                            {trx.items.reduce((acc, i) => acc + i.qty, 0)} pcs
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-black text-[#332219] whitespace-nowrap">
                            {formatRupiah(trx.grand_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LABA RUGI DETAIL (P&L STATEMENT) */}
          {activeTab === 'profit' && isAdmin && (
            <div className="space-y-6 animate-fadeIn">
              {/* Financial Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-[#edf5ee] border border-[#cce2cf] shadow-xs">
                  <div className="flex items-center space-x-2 text-[#166534] mb-1">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-wider">Laba Bersih Usaha (Net Profit)</span>
                  </div>
                  <div className="text-3xl font-black font-mono text-[#166534] mt-2">
                    {formatRupiah(metrics.netProfit)}
                  </div>
                  <p className="text-xs text-[#1b4332] font-semibold mt-1">
                    Margin Bersih Riil: <span className="font-black">{metrics.netProfitMarginPercent.toFixed(1)}%</span>
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs">
                  <div className="flex items-center space-x-2 text-[#8c5e3c] mb-1">
                    <Boxes className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-wider">Total Modal HPP Penjualan</span>
                  </div>
                  <div className="text-3xl font-black font-mono text-[#8c5e3c] mt-2">
                    {formatRupiah(metrics.totalCOGS)}
                  </div>
                  <p className="text-xs text-[#856b59] font-medium mt-1">
                    Harga pokok dari {metrics.totalItems.toLocaleString('id-ID')} item terjual
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs">
                  <div className="flex items-center space-x-2 text-[#b91c1c] mb-1">
                    <TrendingDown className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-wider">Total Beban Operasional</span>
                  </div>
                  <div className="text-3xl font-black font-mono text-[#b91c1c] mt-2">
                    {formatRupiah(metrics.totalExpenses)}
                  </div>
                  <p className="text-xs text-[#856b59] font-medium mt-1">
                    Listrik, air, gaji kasir & perlengkapan
                  </p>
                </div>
              </div>

              {/* Step-by-Step P&L Calculation Breakdown Card */}
              <div className="p-6 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-5">
                <h4 className="font-extrabold text-sm text-[#332219] flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-[#7c4e2f]" />
                  <span>Struktur Laporan Laba Rugi Komprehensif</span>
                </h4>

                <div className="space-y-3 font-mono text-xs">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-2xl bg-[#fcf9f5] border border-[#f0e4d7] space-y-1.5">
                    <div className="flex justify-between font-bold text-[#332219]">
                      <span>1. Pendapatan Penjualan Kotor (Gross Sales)</span>
                      <span>{formatRupiah(metrics.totalGrossRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 pl-4">
                      <span>- Potongan Diskon & Promo Pelanggan</span>
                      <span>-{formatRupiah(metrics.totalDiscount)}</span>
                    </div>
                    <div className="flex justify-between font-black text-[#7c4e2f] pt-1 border-t border-[#dfcebe]">
                      <span>= PENDAPATAN PENJUALAN BERSIH (NET REVENUE)</span>
                      <span>{formatRupiah(metrics.totalNetRevenue)}</span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-2xl bg-[#fcf9f5] border border-[#f0e4d7] space-y-1.5">
                    <div className="flex justify-between text-[#856b59]">
                      <span>2. Harga Pokok Penjualan (HPP / COGS)</span>
                      <span>-{formatRupiah(metrics.totalCOGS)}</span>
                    </div>
                    <div className="flex justify-between font-black text-[#166534] pt-1 border-t border-[#dfcebe]">
                      <span>= LABA KOTOR (GROSS PROFIT)</span>
                      <span>{formatRupiah(metrics.grossProfit)} ({metrics.grossProfitMarginPercent.toFixed(1)}%)</span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-2xl bg-[#fcf9f5] border border-[#f0e4d7] space-y-1.5">
                    <div className="flex justify-between font-bold text-[#332219]">
                      <span>3. Beban & Biaya Operasional Toko</span>
                      <span className="text-rose-700">-{formatRupiah(metrics.totalExpenses)}</span>
                    </div>
                    {filteredExpenses.map((e) => (
                      <div key={e.id} className="flex justify-between text-[#856b59] pl-4 text-[11px]">
                        <span>• {e.title}</span>
                        <span>{formatRupiah(e.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-black text-[#166534] text-sm pt-2 border-t-2 border-[#166534]">
                      <span>= LABA BERSIH OPERASIONAL (NET PROFIT)</span>
                      <span>{formatRupiah(metrics.netProfit)} ({metrics.netProfitMarginPercent.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUK TERLARIS (BEST SELLERS) */}
          {activeTab === 'products' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-4">
                
                {/* Header & Category Filters */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    <h4 className="font-extrabold text-sm text-[#332219]">Peringkat Produk Terlaris (*Top Selling Items*)</h4>
                  </div>

                  {/* Category Pills Strip */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                    {metrics.allCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedProductCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0 shadow-2xs active:scale-95 ${
                          selectedProductCategory === cat
                            ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                            : 'bg-[#fcf9f5] text-[#543c2e] border-[#dfcebe] hover:bg-[#faebd7]'
                        }`}
                      >
                        {cat === 'ALL' ? 'Semua Kategori' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[400px] border border-[#f0e4d7] rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Peringkat</th>
                        <th className="py-3 px-4">Nama Produk & Barcode</th>
                        <th className="py-3 px-4">Kategori</th>
                        <th className="py-3 px-4 text-right">Volume Terjual</th>
                        <th className="py-3 px-4 text-right">Total Nilai Penjualan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {metrics.rankedProducts
                        .filter((item) => selectedProductCategory === 'ALL' || (item.product as any).category === selectedProductCategory)
                        .slice(0, 50)
                        .map((item, idx: number) => (
                          <tr key={idx} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4 font-bold whitespace-nowrap">
                              {idx === 0 ? (
                                <span className="px-2.5 py-1 rounded-full bg-[#faebd7] text-[#7c4e2f] font-black border border-[#e8d5c0] shadow-2xs">🥇 #1</span>
                              ) : idx === 1 ? (
                                <span className="px-2.5 py-1 rounded-full bg-[#f0e8e0] text-[#634837] font-black border border-[#dfd5cb] shadow-2xs">🥈 #2</span>
                              ) : idx === 2 ? (
                                <span className="px-2.5 py-1 rounded-full bg-[#fcf5ed] text-[#8c5e3c] font-black border border-[#eed7c4] shadow-2xs">🥉 #3</span>
                              ) : (
                                <span className="text-[#a08573] font-mono font-bold pl-2">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm">{item.product.name}</div>
                              <div className="text-[11px] text-[#856b59] font-mono">{(item.product as any).barcode || '-'}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#f5ece3] text-[#543c2e]">
                                {(item.product as any).category || 'Umum'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-black font-mono text-[#332219] text-sm whitespace-nowrap">
                              {item.qty.toLocaleString('id-ID')} pcs
                            </td>
                            <td className="py-3 px-4 text-right font-black font-mono text-[#7c4e2f] text-sm whitespace-nowrap">
                              {formatRupiah(item.totalSales)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ASET & MUTASI STOK (KHUSUS ADMIN) */}
          {activeTab === 'inventory' && isAdmin && (
            <div className="space-y-4 animate-fadeIn">
              {/* 3 Modern Bento Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#856b59] mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider">Total Fisik Persediaan</span>
                    <div className="p-1.5 rounded-xl bg-[#faebd7] text-[#7c4e2f]">
                      <Boxes className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-[#332219] mt-1">
                    {metrics.totalStockQty.toLocaleString('id-ID')} <span className="text-xs font-semibold text-[#856b59]">Pcs</span>
                  </div>
                  <span className="text-[11px] text-[#a08573] mt-2 block font-medium pt-1.5 border-t border-[#f0e4d7]">
                    {products.length.toLocaleString('id-ID')} SKU Master Data
                  </span>
                </div>

                <div className="p-4 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#8c5e3c] mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider">Nilai Aset HPP (Harga Beli)</span>
                    <div className="p-1.5 rounded-xl bg-[#faebd7] text-[#8c5e3c]">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#8c5e3c] mt-1 break-all">
                    {formatRupiah(metrics.totalInventoryAssetValue)}
                  </div>
                  <span className="text-[11px] text-[#a08573] mt-2 block font-medium pt-1.5 border-t border-[#f0e4d7]">
                    Modal tertahan di rak toko
                  </span>
                </div>

                <div className="p-4 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[#166534] mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider">Nilai Potensi Jual (Retail)</span>
                    <div className="p-1.5 rounded-xl bg-[#edf5ee] text-[#166534]">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-base sm:text-lg lg:text-xl font-black font-mono text-[#166534] mt-1 break-all">
                    {formatRupiah(metrics.totalRetailAssetValue)}
                  </div>
                  <span className="text-[11px] text-[#a08573] mt-2 block font-medium pt-1.5 border-t border-[#f0e4d7]">
                    Nilai jika seluruh stok terjual
                  </span>
                </div>
              </div>

              {/* Inventory Table with Search & Stock Filter */}
              <div className="p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-extrabold text-sm text-[#332219]">Daftar Valuasi & Status Stok per Produk</h4>
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => setInventoryStockFilter('ALL')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          inventoryStockFilter === 'ALL' ? 'bg-[#7c4e2f] text-white shadow-2xs' : 'bg-[#f5ece3] text-[#543c2e] hover:bg-[#ebdccf]'
                        }`}
                      >
                        Semua ({products.length.toLocaleString('id-ID')})
                      </button>
                      <button
                        onClick={() => setInventoryStockFilter('CRITICAL')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all ${
                          inventoryStockFilter === 'CRITICAL' ? 'bg-rose-700 text-white shadow-2xs' : 'bg-[#fbeeed] text-rose-700 border border-[#f4cfcf] hover:bg-[#f8dedd]'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Kritis ({metrics.criticalStockCount.toLocaleString('id-ID')})</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative w-72">
                    <Search className="w-4 h-4 text-[#856b59] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cari SKU / nama produk..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dfcebe] text-xs focus:border-[#7c4e2f] focus:ring-2 focus:ring-[#7c4e2f]/20 bg-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[380px] border border-[#f0e4d7] rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Produk & Lokasi Rak</th>
                        <th className="py-3 px-4">Kategori</th>
                        <th className="py-3 px-4 text-right">Sisa Stok</th>
                        <th className="py-3 px-4 text-right">Harga Beli HPP</th>
                        <th className="py-3 px-4 text-right">Total Nilai Aset</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {paginatedInventoryProducts.map((p: Product) => {
                        const isLow = p.stock <= p.min_stock_alert;
                        return (
                          <tr key={p.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#332219] text-sm">{p.name}</div>
                              <div className="text-[10px] text-[#856b59] font-mono">{p.barcode} • {p.rack_location}</div>
                            </td>
                            <td className="py-3 px-4 text-[#543c2e] whitespace-nowrap">{p.category}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#332219] text-sm whitespace-nowrap">{p.stock.toLocaleString('id-ID')} {p.unit}</td>
                            <td className="py-3 px-4 text-right font-mono text-[#856b59] whitespace-nowrap">{formatRupiah(p.buy_price)}</td>
                            <td className="py-3 px-4 text-right font-mono font-black text-[#7c4e2f] text-sm whitespace-nowrap">{formatRupiah(p.stock * p.buy_price)}</td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border shadow-2xs ${
                                isLow ? 'bg-[#fbeeed] text-rose-800 border-[#f4cfcf]' : 'bg-[#edf5ee] text-[#166534] border-[#cce2cf]'
                              }`}>
                                {isLow ? 'Stok Kritis' : 'Normal'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Inventory Pagination Footer Bar */}
                <div className="px-4 py-3 bg-[#fdfaf7] border border-[#eed7c4] rounded-2xl flex items-center justify-between text-xs text-[#8a6b53]">
                  <span>
                    Menampilkan <strong>{paginatedInventoryProducts.length > 0 ? (inventoryPage - 1) * INVENTORY_PAGE_SIZE + 1 : 0} - {Math.min(inventoryPage * INVENTORY_PAGE_SIZE, filteredInventoryProducts.length)}</strong> dari <strong>{filteredInventoryProducts.length.toLocaleString('id-ID')}</strong> produk
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={inventoryPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-[#dfcebe] bg-white text-[#332219] font-bold disabled:opacity-40 hover:bg-[#faebd7] flex items-center space-x-1 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <span className="font-mono font-bold text-[#7c4e2f] px-2">
                      {inventoryPage} / {inventoryTotalPages}
                    </span>

                    <button
                      onClick={() => setInventoryPage((prev) => Math.min(inventoryTotalPages, prev + 1))}
                      disabled={inventoryPage >= inventoryTotalPages}
                      className="px-2.5 py-1 rounded-lg border border-[#dfcebe] bg-white text-[#332219] font-bold disabled:opacity-40 hover:bg-[#faebd7] flex items-center space-x-1 transition-colors"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ANALISIS METODE PEMBAYARAN */}
          {activeTab === 'payment' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Payment Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div 
                  onClick={() => setPaymentFilterMethod(paymentFilterMethod === 'CASH' ? 'ALL' : 'CASH')}
                  className={`p-4 rounded-3xl bg-white border shadow-xs cursor-pointer transition-all ${
                    paymentFilterMethod === 'CASH' ? 'border-[#7c4e2f] ring-2 ring-[#7c4e2f]/20 shadow-sm' : 'border-[#e4d5c7] hover:border-[#b8957c]'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-[#166534] mb-1.5">
                    <Banknote className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Tunai (Cash)</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#332219] whitespace-nowrap">
                    {formatRupiah(metrics.paymentMethodMap.CASH)}
                  </div>
                  <span className="text-[11px] text-[#856b59] mt-1 block font-medium">
                    {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.CASH / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total
                  </span>
                </div>

                <div 
                  onClick={() => setPaymentFilterMethod(paymentFilterMethod === 'QRIS' ? 'ALL' : 'QRIS')}
                  className={`p-4 rounded-3xl bg-white border shadow-xs cursor-pointer transition-all ${
                    paymentFilterMethod === 'QRIS' ? 'border-[#7c4e2f] ring-2 ring-[#7c4e2f]/20 shadow-sm' : 'border-[#e4d5c7] hover:border-[#b8957c]'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-[#0369a1] mb-1.5">
                    <QrCode className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">QRIS Dinamis/Statis</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#332219] whitespace-nowrap">
                    {formatRupiah(metrics.paymentMethodMap.QRIS)}
                  </div>
                  <span className="text-[11px] text-[#856b59] mt-1 block font-medium">
                    {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.QRIS / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total
                  </span>
                </div>

                <div 
                  onClick={() => setPaymentFilterMethod(paymentFilterMethod === 'DEBIT' ? 'ALL' : 'DEBIT')}
                  className={`p-4 rounded-3xl bg-white border shadow-xs cursor-pointer transition-all ${
                    paymentFilterMethod === 'DEBIT' ? 'border-[#7c4e2f] ring-2 ring-[#7c4e2f]/20 shadow-sm' : 'border-[#e4d5c7] hover:border-[#b8957c]'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-[#6b21a8] mb-1.5">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Kartu Debit/EDC</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#332219] whitespace-nowrap">
                    {formatRupiah(metrics.paymentMethodMap.DEBIT)}
                  </div>
                  <span className="text-[11px] text-[#856b59] mt-1 block font-medium">
                    {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.DEBIT / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total
                  </span>
                </div>

                <div 
                  onClick={() => setPaymentFilterMethod(paymentFilterMethod === 'TRANSFER' ? 'ALL' : 'TRANSFER')}
                  className={`p-4 rounded-3xl bg-white border shadow-xs cursor-pointer transition-all ${
                    paymentFilterMethod === 'TRANSFER' ? 'border-[#7c4e2f] ring-2 ring-[#7c4e2f]/20 shadow-sm' : 'border-[#e4d5c7] hover:border-[#b8957c]'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-[#8c5e3c] mb-1.5">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Transfer Bank</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#332219] whitespace-nowrap">
                    {formatRupiah(metrics.paymentMethodMap.TRANSFER)}
                  </div>
                  <span className="text-[11px] text-[#856b59] mt-1 block font-medium">
                    {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.TRANSFER / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total
                  </span>
                </div>
              </div>

              {/* Transactions filtered by payment method */}
              <div className="p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-[#332219]">
                    Rincian Transaksi {paymentFilterMethod !== 'ALL' ? `(Metode: ${paymentFilterMethod})` : 'Semua Metode'}
                  </h4>
                  {paymentFilterMethod !== 'ALL' && (
                    <button
                      onClick={() => setPaymentFilterMethod('ALL')}
                      className="text-xs text-[#7c4e2f] font-bold hover:underline"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto max-h-[350px] border border-[#f0e4d7] rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">No. Invoice</th>
                        <th className="py-3 px-4">Kasir</th>
                        <th className="py-3 px-4 text-right">Jumlah Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {filteredTransactions
                        .filter((t) => paymentFilterMethod === 'ALL' || t.payment_method === paymentFilterMethod)
                        .slice(0, 40)
                        .map((trx) => (
                          <tr key={trx.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-2.5 px-4 text-[#856b59] font-mono text-[11px]">
                              {new Date(trx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-[#332219]">{trx.receipt_number}</td>
                            <td className="py-2.5 px-4 text-[#543c2e]">{trx.cashier_name || 'Kasir'}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-black text-[#332219]">
                              {formatRupiah(trx.grand_total)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 4. Footer */}
        <div className="p-4 border-t border-[#e4d5c7] bg-[#f5ece3] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#856b59] flex items-center space-x-2 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>Data tersinkronisasi real-time dengan IndexedDB KetokoPOS</span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-[#7c4e2f] hover:bg-[#633e26] text-white font-bold text-xs transition-all shadow-xs active:scale-95"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
