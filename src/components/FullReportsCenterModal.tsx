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
  RefreshCw,
  Users,
  Download,
  FileSpreadsheet,
  Smartphone,
  ShieldCheck,
  RotateCcw,
  Wallet
} from 'lucide-react';
import { db } from '../db';
import type { Transaction, Product, TransactionItem, OperationalExpense, StoreProfile, Customer } from '../types';
import { exportReportToPDF, exportReportToExcel } from '../services/pdfReportService';
import { 
  exportCustomerItemsToExcel, 
  type CustomerReportGroupData, 
  type CustomerItemRowData 
} from '../services/excelReportService';
import { formatRupiah, ESCPOSBuilder, printToWebSerial } from '../services/escposService';
import { syncService } from '../services/syncService';
import { lanService } from '../services/lanService';
import { employeeAllowanceService, type EmployeeAllowanceReport, type EmployeeAllowanceRecord } from '../services/employeeAllowanceService';
import { filterCustomersForStore } from '../utils/customerAccess';
import { CustomSelect } from './CustomSelect';

interface FullReportsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'sales' | 'products' | 'profit' | 'inventory' | 'payment' | 'customer_items' | 'employee_allowance';
  userRole?: 'SUPERADMIN' | 'ADMIN' | 'CASHIER' | 'MANAGER';
  cashierName?: string;
  branchId?: string;
}

// Default initial operational expenses (clean 0-data state)
const INITIAL_EXPENSES: OperationalExpense[] = [];

const getLocalDateKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getYesterdayDateKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
};

const parseLocalDateStart = (yyyyMmDd: string): Date => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return new Date(0);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const parseLocalDateEnd = (yyyyMmDd: string): Date => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

export const FullReportsCenterModal: React.FC<FullReportsCenterModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'sales',
  userRole = 'ADMIN',
  cashierName = 'Kasir Toko',
  branchId = 'BR-01'
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'profit' | 'inventory' | 'payment' | 'customer_items' | 'employee_allowance'>(initialTab);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Employee Allowance Report States
  const [employeeReport, setEmployeeReport] = useState<EmployeeAllowanceReport | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXHAUSTED' | 'SHOPPED' | 'CASH_SHOPPED' | 'NOT_SHOPPED'>('ALL');
  const [employeeMonth, setEmployeeMonth] = useState<string>(() => employeeAllowanceService.getCurrentMonthKey());
  const [employeeAfdelingFilter, setEmployeeAfdelingFilter] = useState<string>('ALL');
  const [showAfdelingSummaryTable, setShowAfdelingSummaryTable] = useState(true);
  const [isResettingEmployees, setIsResettingEmployees] = useState(false);
  
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'date' | '7days' | 'month' | 'all' | 'custom'>('today');
  
  const todayStr = getLocalDateKey();
  const yesterdayStr = getYesterdayDateKey();
  const [targetDate, setTargetDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('ALL');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('ALL');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'ALL' | 'CRITICAL'>('ALL');
  const [paymentFilterMethod, setPaymentFilterMethod] = useState<'ALL' | 'CASH' | 'SALDO' | 'QRIS' | 'DEBIT' | 'TRANSFER'>('ALL');

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

  const filterByActiveStore = (list: Transaction[]) => {
    const activeStoreId = typeof window !== 'undefined' ? (localStorage.getItem('ketoko_active_store_id') || 'store-01') : 'store-01';
    return list.filter((t: any) => {
      if (activeStoreId === 'store-01') {
        if (t.store_id && t.store_id !== 'store-01') return false;
        const cashier = (t.cashier_name || '').toLowerCase();
        if (cashier.includes('toko b') || cashier.includes('koperasi b')) return false;
        const items = Array.isArray(t.items) ? t.items : [];
        if (items.some((it: any) => {
          const n = (it.name || '').toLowerCase();
          return n.includes('minyak goreng') || n.includes('koperasi b') || n.includes('beras premium');
        })) return false;
        return true;
      }
      return t.store_id === activeStoreId;
    });
  };

  const loadReportData = async (syncCloud = false) => {
    try {
      // 1. Ambil data lokal seketika (instant 0ms)
      const allTrx = await db.transactions.toArray();
      const allProducts = await db.products.toArray();
      const allCust = await db.customers.toArray();
      const activeStoreId = typeof window !== 'undefined' ? (localStorage.getItem('ketoko_active_store_id') || 'store-01') : 'store-01';
      setTransactions(filterByActiveStore(allTrx));
      setProducts(allProducts);
      setCustomers(filterCustomersForStore(allCust, activeStoreId));

      // 2. Tarik update transaksi & pelanggan terbaru dari LAN Server jika aktif
      if (lanService.isLanActive()) {
        try {
          const centralTrx = await lanService.fetchCentralTransactions(500, undefined, activeStoreId);
          if (centralTrx && centralTrx.length > 0) {
            await db.transactions.bulkPut(centralTrx);
          }
          await lanService.fetchCustomersFromLan(activeStoreId);
          const freshCust = await db.customers.toArray();
          setCustomers(filterCustomersForStore(freshCust, activeStoreId));
        } catch (lanErr) {
          console.warn('[FullReports] LAN pull deferred:', lanErr);
        }
      }

      // 3. Tarik update transaksi terbaru dari Supabase Cloud di background
      if (syncCloud && navigator.onLine) {
        setIsRefreshing(true);
        try {
          await syncService.pullTransactionsFromSupabase(500);
          await syncService.pullCustomersFromSupabase();
          const freshTrx = await db.transactions.toArray();
          const freshCust = await db.customers.toArray();
          setTransactions(filterByActiveStore(freshTrx));
          setCustomers(filterCustomersForStore(freshCust, activeStoreId));
        } catch (err) {
          console.warn('[FullReports] Cloud pull deferred:', err);
        } finally {
          setIsRefreshing(false);
        }
      } else if (lanService.isLanActive()) {
        const freshTrx = await db.transactions.toArray();
        setTransactions(filterByActiveStore(freshTrx));
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
        const filtered = filterByActiveStore([trx]);
        if (filtered.length > 0) {
          setTransactions((prev) => {
            if (prev.some((t) => t.id === trx.id)) return prev;
            return [trx, ...prev];
          });
        }
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
      setTransactions(filterByActiveStore(allTrx));
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

  // Filter transactions based on active Date Preset (using local calendar date boundaries)
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStart = parseLocalDateStart(getLocalDateKey(now));
    const todayEnd = parseLocalDateEnd(getLocalDateKey(now));

    return transactions.filter((t) => {
      const tDate = new Date(t.created_at);
      if (dateFilter === 'today') {
        return tDate >= todayStart && tDate <= todayEnd;
      } else if (dateFilter === 'yesterday') {
        const yKey = getYesterdayDateKey();
        return tDate >= parseLocalDateStart(yKey) && tDate <= parseLocalDateEnd(yKey);
      } else if (dateFilter === 'date') {
        const dKey = targetDate || getLocalDateKey(now);
        return tDate >= parseLocalDateStart(dKey) && tDate <= parseLocalDateEnd(dKey);
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
        return tDate >= sevenDaysAgo && tDate <= todayEnd;
      } else if (dateFilter === 'month') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return tDate >= firstDayOfMonth && tDate <= todayEnd;
      } else if (dateFilter === 'custom') {
        const start = parseLocalDateStart(startDate);
        const end = parseLocalDateEnd(endDate);
        return tDate >= start && tDate <= end;
      }
      return true; // 'all'
    });
  }, [transactions, dateFilter, targetDate, startDate, endDate]);

  // Filter expenses based on active Date Preset
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStart = parseLocalDateStart(getLocalDateKey(now));
    const todayEnd = parseLocalDateEnd(getLocalDateKey(now));

    return expenses.filter((e) => {
      const eDate = parseLocalDateStart(e.date);
      if (dateFilter === 'today') {
        return eDate >= todayStart && eDate <= todayEnd;
      } else if (dateFilter === 'yesterday') {
        const yKey = getYesterdayDateKey();
        return eDate >= parseLocalDateStart(yKey) && eDate <= parseLocalDateEnd(yKey);
      } else if (dateFilter === 'date') {
        const dKey = targetDate || getLocalDateKey(now);
        return eDate >= parseLocalDateStart(dKey) && eDate <= parseLocalDateEnd(dKey);
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
        return eDate >= sevenDaysAgo && eDate <= todayEnd;
      } else if (dateFilter === 'month') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return eDate >= firstDayOfMonth && eDate <= todayEnd;
      } else if (dateFilter === 'custom') {
        const start = parseLocalDateStart(startDate);
        const end = parseLocalDateEnd(endDate);
        return eDate >= start && eDate <= end;
      }
      return true;
    });
  }, [expenses, dateFilter, targetDate, startDate, endDate]);

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
      SALDO: 0,
      QRIS: 0,
      DEBIT: 0,
      TRANSFER: 0
    };

    const paymentCountMap: Record<string, number> = {
      CASH: 0,
      SALDO: 0,
      QRIS: 0,
      DEBIT: 0,
      TRANSFER: 0
    };

    const productSalesMap = new Map<string, { product: Product; qty: number; totalSales: number; totalCost: number }>();
    const categorySalesMap = new Map<string, { qty: number; totalSales: number; totalCost: number }>();

    filteredTransactions.forEach((trx) => {
      const itemsSum = (trx.items || []).reduce(
        (s, it) => s + (Number(it.subtotal_item) || (Number(it.price_applied) || 0) * (Number(it.qty) || 1)),
        0
      );
      const effSubtotal = Number(trx.subtotal) > 0 ? Number(trx.subtotal) : itemsSum;
      const effGrandTotal =
        Number(trx.grand_total) > 0
          ? Number(trx.grand_total)
          : Math.max(0, effSubtotal - (Number(trx.discount_amount) || 0) + (Number(trx.tax_amount) || 0));

      totalGrossRevenue += effSubtotal;
      totalDiscount += trx.discount_amount || 0;
      totalNetRevenue += effGrandTotal;
      totalTax += trx.tax_amount || 0;

      const pMethod = trx.payment_method || 'CASH';
      paymentMethodMap[pMethod] = (paymentMethodMap[pMethod] || 0) + effGrandTotal;
      paymentCountMap[pMethod] = (paymentCountMap[pMethod] || 0) + 1;

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
      paymentCountMap,
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

  // Helper to format date label
  const periodFormattedHeader = useMemo(() => {
    if (dateFilter === 'custom') {
      const s = parseLocalDateStart(startDate);
      const e = parseLocalDateStart(endDate);
      const sStr = s.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const eStr = e.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return `Dari ${sStr} s/d ${eStr}`;
    } else if (dateFilter === 'today') {
      const t = parseLocalDateStart(getLocalDateKey()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return `Hari Ini (${t})`;
    } else if (dateFilter === 'yesterday') {
      const y = parseLocalDateStart(getYesterdayDateKey()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return `Kemarin (${y})`;
    } else if (dateFilter === 'date') {
      const d = parseLocalDateStart(targetDate || getLocalDateKey()).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      return `Tanggal: ${d}`;
    } else if (dateFilter === '7days') {
      const now = new Date();
      const sevenAgo = new Date();
      sevenAgo.setDate(now.getDate() - 6);
      return `7 Hari (${sevenAgo.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else if (dateFilter === 'month') {
      return `Bulan Ini (${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
    }
    return 'Semua Periode Transaksi';
  }, [dateFilter, targetDate, startDate, endDate]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  // Customer & Item Report Grouping
  const customerReportGroups = useMemo(() => {
    const map = new Map<string, Map<string, CustomerItemRowData>>();

    filteredTransactions.forEach((trx) => {
      let rawName = (trx.customer_name || '').trim();
      if (!rawName && trx.member_id) {
        rawName = (customerMap.get(trx.member_id) || '').trim();
      }
      const customer = rawName ? rawName.toUpperCase() : (trx.payment_method ? trx.payment_method.toUpperCase() : 'CASH');

      if (!map.has(customer)) {
        map.set(customer, new Map<string, CustomerItemRowData>());
      }
      const itemMap = map.get(customer)!;

      (trx.items || []).forEach((it) => {
        const prod = productMap.get(it.product_id);
        const buyPrice = Number(it.buy_price) > 0 ? Number(it.buy_price) : (prod?.buy_price || 0);
        const qty = Number(it.qty) || 0;
        const unitPrice = Number(it.price_applied) || 0;
        const sales = Number(it.subtotal_item) || (qty * unitPrice);
        const modal = buyPrice * qty;

        const key = `${it.product_name}__${unitPrice}`;
        const existing = itemMap.get(key);

        if (existing) {
          existing.qty += qty;
          existing.modal += modal;
          existing.sales += sales;
          existing.profit += (sales - modal);
        } else {
          itemMap.set(key, {
            product_id: it.product_id,
            product_name: it.product_name,
            qty,
            modal,
            unit_modal: buyPrice,
            unit_price: unitPrice,
            sales,
            profit: sales - modal
          });
        }
      });
    });

    const groups: CustomerReportGroupData[] = [];
    map.forEach((itemMap, customer_name) => {
      const items = Array.from(itemMap.values());
      const total_qty = items.reduce((s, i) => s + i.qty, 0);
      const total_modal = items.reduce((s, i) => s + i.modal, 0);
      const total_sales = items.reduce((s, i) => s + i.sales, 0);
      const total_profit = items.reduce((s, i) => s + i.profit, 0);

      groups.push({
        customer_name,
        items,
        total_qty,
        total_modal,
        total_sales,
        total_profit
      });
    });

    groups.sort((a, b) => {
      if (a.customer_name === 'CASH' && b.customer_name !== 'CASH') return 1;
      if (a.customer_name !== 'CASH' && b.customer_name === 'CASH') return -1;
      return a.customer_name.localeCompare(b.customer_name);
    });

    return groups;
  }, [filteredTransactions, productMap, customerMap]);

  const allCustomerNames = useMemo(() => {
    return Array.from(new Set(customerReportGroups.map((g) => g.customer_name))).sort();
  }, [customerReportGroups]);

  const filteredCustomerReportGroups = useMemo(() => {
    let result = customerReportGroups;

    if (selectedCustomerFilter !== 'ALL') {
      result = result.filter((g) => g.customer_name === selectedCustomerFilter);
    }

    const q = customerSearchTerm.trim().toLowerCase();
    if (q) {
      result = result
        .map((g) => {
          const matchCust = g.customer_name.toLowerCase().includes(q);
          if (matchCust) return g;
          const matchItems = g.items.filter((it) => it.product_name.toLowerCase().includes(q));
          if (matchItems.length > 0) {
            return {
              ...g,
              items: matchItems,
              total_qty: matchItems.reduce((s, i) => s + i.qty, 0),
              total_modal: matchItems.reduce((s, i) => s + i.modal, 0),
              total_sales: matchItems.reduce((s, i) => s + i.sales, 0),
              total_profit: matchItems.reduce((s, i) => s + i.profit, 0)
            };
          }
          return null;
        })
        .filter(Boolean) as CustomerReportGroupData[];
    }

    return result;
  }, [customerReportGroups, customerSearchTerm, selectedCustomerFilter]);

  const customerGrandTotals = useMemo(() => {
    let modal = 0;
    let qty = 0;
    let sales = 0;
    let profit = 0;
    filteredCustomerReportGroups.forEach((g) => {
      modal += g.total_modal;
      qty += g.total_qty;
      sales += g.total_sales;
      profit += g.total_profit;
    });
    return { modal, qty, sales, profit };
  }, [filteredCustomerReportGroups]);

  // Load and refresh Employee Allowance Report
  useEffect(() => {
    if (isOpen) {
      employeeAllowanceService.generateMonthlyReport(customers, transactions, employeeMonth).then(setEmployeeReport).catch(console.error);
    }
  }, [isOpen, activeTab, transactions, customers, employeeMonth]);

  const filteredEmployees = useMemo(() => {
    if (!employeeReport) return [];
    let list = employeeReport.employees;
    if (employeeStatusFilter === 'ACTIVE') {
      list = list.filter((e: EmployeeAllowanceRecord) => e.status === 'ACTIVE');
    } else if (employeeStatusFilter === 'EXHAUSTED') {
      list = list.filter((e: EmployeeAllowanceRecord) => e.status === 'EXHAUSTED');
    } else if (employeeStatusFilter === 'SHOPPED') {
      list = list.filter((e: EmployeeAllowanceRecord) => e.spent_this_month > 0);
    } else if (employeeStatusFilter === 'CASH_SHOPPED') {
      list = list.filter((e: EmployeeAllowanceRecord) => (e.cash_spent_this_month || 0) > 0);
    } else if (employeeStatusFilter === 'NOT_SHOPPED') {
      list = list.filter((e: EmployeeAllowanceRecord) => e.spent_this_month <= 0 && (e.cash_spent_this_month || 0) <= 0);
    }
    if (employeeAfdelingFilter !== 'ALL') {
      list = list.filter((e: EmployeeAllowanceRecord) => (e.afdeling || 'UMUM').toUpperCase() === employeeAfdelingFilter.toUpperCase());
    }
    const q = employeeSearchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((e: EmployeeAllowanceRecord) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.phone.includes(q) ||
        (e.afdeling && e.afdeling.toLowerCase().includes(q))
      );
    }
    return list;
  }, [employeeReport, employeeStatusFilter, employeeAfdelingFilter, employeeSearchTerm]);

  const afdelingOptions = useMemo(() => {
    if (!employeeReport) return [];
    const set = new Set<string>();
    employeeReport.employees.forEach((e: EmployeeAllowanceRecord) => {
      set.add((e.afdeling || 'UMUM').toUpperCase());
    });
    return Array.from(set).sort();
  }, [employeeReport]);

  const afdelingSummaries = useMemo(() => {
    if (!employeeReport) return [];
    return employeeAllowanceService.generateAfdelingSummaries(employeeReport.employees);
  }, [employeeReport]);

  const handleResetAllEmployeesFromReport = async () => {
    const totalEmp = employeeReport?.summary.total_employees || 0;
    const confirmWord = window.prompt(
      `⚠️ PERINGATAN RESET MASSAL (${totalEmp} Karyawan)\n\nKetik "RESET" (huruf besar) untuk mereset seluruh saldo kuota karyawan kembali ke Rp 2.000.000.\n\n(Tips: Jika terjadi salah reset, Anda bisa menekan tombol "🛠️ Pulihkan Saldo dari Transaksi" untuk mengembalikan sisa saldo sesuai riwayat belanja bulan ini).`
    );
    if (!confirmWord || confirmWord.trim().toUpperCase() !== 'RESET') {
      return;
    }
    setIsResettingEmployees(true);
    try {
      const res = await employeeAllowanceService.resetEmployeeAllowance();
      if (res.success) {
        const updated = await employeeAllowanceService.generateMonthlyReport(customers, transactions, employeeMonth);
        setEmployeeReport(updated);
        alert(`Berhasil! Saldo kuota ${res.count || totalEmp} karyawan telah direset ke Rp 2.000.000.`);
      } else {
        alert('Gagal reset: ' + (res.message || 'Error'));
      }
    } catch (err: any) {
      alert('Error saat reset: ' + (err.message || ''));
    } finally {
      setIsResettingEmployees(false);
    }
  };

  const handleRestoreBalancesFromTransactions = async () => {
    if (
      !window.confirm(
        `🛠️ PULIHKAN SALDO DARI RIWAYAT TRANSAKSI (${employeeReport?.period_name || employeeMonth})\n\nSistem akan menghitung ulang:\nSisa Saldo = Plafon Rp 2.000.000 - Total Belanja Potong Saldo Bulan Ini\nberdasarkan nota transaksi kasir yang tercatat, lalu memulihkan saldo seluruh karyawan.\n\nLanjutkan pemulihan saldo?`
      )
    ) {
      return;
    }
    setIsResettingEmployees(true);
    try {
      const res = await employeeAllowanceService.recalculateBalancesFromTransactions(undefined, employeeMonth);
      const refreshedCusts = await db.customers.toArray();
      setCustomers(refreshedCusts);
      const updated = await employeeAllowanceService.generateMonthlyReport(refreshedCusts, transactions, employeeMonth);
      setEmployeeReport(updated);
      alert(`✅ ${res.message}`);
    } catch (err: any) {
      alert('Gagal memulihkan saldo: ' + (err.message || ''));
    } finally {
      setIsResettingEmployees(false);
    }
  };

  const handleResetSingleFromReport = async (empId: string, name: string, targetAllowance: number) => {
    const empRecord = employeeReport?.employees.find((e) => e.customer_id === empId);
    const spentMonth = empRecord?.spent_this_month || 0;
    if (spentMonth > 0) {
      const choice = window.prompt(
        `Pilih aksi untuk "${name}":\n- Belanja Potong Saldo Bulan Ini: ${formatRupiah(spentMonth)}\n- Seharusnya Sisa Saldo: ${formatRupiah(Math.max(0, targetAllowance - spentMonth))}\n\nKetik "1" untuk PULIHKAN sesuai potongan transaksi (${formatRupiah(Math.max(0, targetAllowance - spentMonth))})\nKetik "2" untuk RESET PENUH ke ${formatRupiah(targetAllowance)}`,
        '1'
      );
      if (!choice) return;
      if (choice.trim() === '1') {
        const res = await employeeAllowanceService.recalculateBalancesFromTransactions(empId, employeeMonth);
        const refreshedCusts = await db.customers.toArray();
        setCustomers(refreshedCusts);
        const updated = await employeeAllowanceService.generateMonthlyReport(refreshedCusts, transactions, employeeMonth);
        setEmployeeReport(updated);
        alert(`✅ Saldo "${name}" berhasil dipulihkan ke ${formatRupiah(Math.max(0, targetAllowance - spentMonth))}.\n(${res.message})`);
        return;
      }
      if (choice.trim() !== '2') return;
    } else if (!confirm(`Reset saldo kuota bulanan karyawan "${name}" kembali ke ${formatRupiah(targetAllowance)}?`)) {
      return;
    }
    try {
      const res = await employeeAllowanceService.resetEmployeeAllowance(empId, targetAllowance);
      if (res.success) {
        const refreshedCusts = await db.customers.toArray();
        setCustomers(refreshedCusts);
        const updated = await employeeAllowanceService.generateMonthlyReport(refreshedCusts, transactions, employeeMonth);
        setEmployeeReport(updated);
      } else {
        alert('Gagal reset: ' + (res.message || 'Error'));
      }
    } catch (err: any) {
      alert('Error saat reset: ' + (err.message || ''));
    }
  };

  // Export active report to A4 PDF with Official Letterhead
  const handleExportPDF = () => {
    const savedStore = localStorage.getItem('ketoko_store_profile');
    const storeProfile: StoreProfile | undefined = savedStore ? JSON.parse(savedStore) : undefined;
    const periodLabel = dateFilter === 'custom' ? `${startDate} s/d ${endDate}` : dateFilter === 'today' ? 'Hari Ini (' + new Date().toLocaleDateString('id-ID') + ')' : dateFilter === '7days' ? '7 Hari Terakhir' : dateFilter === 'month' ? 'Bulan Ini (' + new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }) + ')' : 'Seluruh Waktu';

    if (activeTab === 'employee_allowance') {
      const rpt = employeeReport;
      if (rpt) {
        employeeAllowanceService.printEmployeeAllowanceReport(
          { ...rpt, employees: filteredEmployees },
          'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI'
        );
      }
      return;
    }

    if (activeTab === 'sales') {
      const validSalesTrx = filteredTransactions.filter((t) => {
        const itemsSum = (t.items || []).reduce(
          (s, it) => s + (Number(it.subtotal_item) || (Number(it.price_applied) || 0) * (Number(it.qty) || 1)),
          0
        );
        return (Number(t.grand_total) || Number(t.subtotal) || itemsSum) > 0 || (t.items && t.items.length > 0);
      });
      exportReportToPDF({
        title: 'LAPORAN REKAPITULASI PENJUALAN & SHIFT KASIR',
        periodText: periodLabel,
        storeProfile,
        kpis: [
          { label: 'Penjualan Bersih', value: formatRupiah(metrics.totalNetRevenue), highlight: true },
          { label: 'Potong Saldo Member', value: formatRupiah(metrics.paymentMethodMap.SALDO || 0), sublabel: `${metrics.paymentCountMap.SALDO || 0} Nota` },
          { label: 'Penjualan Tunai (CASH)', value: formatRupiah(metrics.paymentMethodMap.CASH || 0), sublabel: `${metrics.paymentCountMap.CASH || 0} Nota` },
          { label: 'Transfer & QRIS/Debit', value: formatRupiah((metrics.paymentMethodMap.TRANSFER || 0) + (metrics.paymentMethodMap.QRIS || 0) + (metrics.paymentMethodMap.DEBIT || 0)), sublabel: `${(metrics.paymentCountMap.TRANSFER || 0) + (metrics.paymentCountMap.QRIS || 0) + (metrics.paymentCountMap.DEBIT || 0)} Nota` }
        ],
        table: {
          headers: ['No', 'No. Nota', 'Waktu Transaksi', 'Pelanggan / Member', 'Kasir / Petugas', 'Metode', 'Rincian Barang', 'Item', 'Total Bayar'],
          rows: validSalesTrx.map((t, idx) => {
            const itemsSum = (t.items || []).reduce(
              (s, it) => s + (Number(it.subtotal_item) || (Number(it.price_applied) || 0) * (Number(it.qty) || 1)),
              0
            );
            const effTotal = Number(t.grand_total) > 0 ? Number(t.grand_total) : (Number(t.subtotal) > 0 ? Number(t.subtotal) : itemsSum);
            const itemsText = (t.items || []).map((it) => `${it.qty}x ${it.product_name}`).join(', ') || '-';
            return [
              idx + 1,
              t.receipt_number,
              new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              t.customer_name || 'Pelanggan Umum',
              t.cashier_name || cashierName,
              t.payment_method,
              itemsText,
              t.items.reduce((s, it) => s + it.qty, 0),
              formatRupiah(effTotal)
            ];
          }),
          alignments: ['center', 'left', 'center', 'left', 'left', 'center', 'left', 'center', 'right'],
          footers: ['TOTAL', `${validSalesTrx.length} Nota`, '', '', '', '', '', `${metrics.totalItems} Pcs`, formatRupiah(metrics.totalNetRevenue)]
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
    } else if (activeTab === 'customer_items') {
      const rows: any[] = [];
      filteredCustomerReportGroups.forEach((g) => {
        g.items.forEach((it, idx) => {
          rows.push([
            idx === 0 ? g.customer_name : '',
            it.product_name,
            it.modal > 0 ? formatRupiah(it.modal) : '-',
            it.qty,
            it.unit_price > 0 ? formatRupiah(it.unit_price) : '-',
            formatRupiah(it.sales)
          ]);
        });
        rows.push([
          '',
          `Total Nama Barang (${g.customer_name})`,
          g.total_modal > 0 ? formatRupiah(g.total_modal) : '-',
          g.total_qty,
          '-',
          formatRupiah(g.total_sales)
        ]);
      });

      exportReportToPDF({
        title: 'LAPORAN PENJUALAN PER PELANGGAN & BARANG',
        periodText: periodFormattedHeader,
        storeProfile,
        kpis: [
          { label: 'Total Pelanggan', value: `${filteredCustomerReportGroups.length} Pelanggan`, highlight: true },
          { label: 'Total Penjualan', value: formatRupiah(customerGrandTotals.sales) },
          { label: 'Total Kuantitas', value: `${customerGrandTotals.qty.toLocaleString('id-ID')} Pcs` },
          { label: 'Total Laba Kotor', value: formatRupiah(customerGrandTotals.profit) }
        ],
        table: {
          headers: ['Pelanggan', 'Nama Barang', 'Modal (Rp)', 'Kuantitas', 'Harga Satuan', 'Penjualan (Rp)'],
          rows,
          alignments: ['left', 'left', 'right', 'center', 'right', 'right'],
          footers: [
            'GRAND TOTAL',
            `Semua ${filteredCustomerReportGroups.length} Pelanggan`,
            formatRupiah(customerGrandTotals.modal),
            String(customerGrandTotals.qty),
            '-',
            formatRupiah(customerGrandTotals.sales)
          ]
        },
        notes: 'Laporan perincian penjualan pelanggan dan item barang resmi Ketoko POS.'
      });
    }
  };

  // Export to native Microsoft Excel (.xls) with custom styling and formula support
  const handleExportExcel = () => {
    const savedStore = localStorage.getItem('ketoko_store_profile');
    const storeProfile: StoreProfile | undefined = savedStore ? JSON.parse(savedStore) : undefined;
    const storeName = storeProfile?.name || 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI';
    const branchName = storeProfile?.branch_name || branchId;
    const periodLabel =
      dateFilter === 'custom'
        ? `${startDate} s/d ${endDate}`
        : dateFilter === 'today'
          ? 'Hari Ini (' + new Date().toLocaleDateString('id-ID') + ')'
          : dateFilter === '7days'
            ? '7 Hari Terakhir'
            : dateFilter === 'month'
              ? 'Bulan Ini (' + new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }) + ')'
              : 'Seluruh Waktu';
    const dateSlug = new Date().toISOString().split('T')[0];

    if (activeTab === 'employee_allowance') {
      if (employeeReport) {
        employeeAllowanceService.exportEmployeeAllowanceExcel(
          { ...employeeReport, employees: filteredEmployees },
          storeName
        );
      }
      return;
    }

    if (activeTab === 'customer_items') {
      exportCustomerItemsToExcel({
        storeName,
        branchName,
        periodText: periodFormattedHeader,
        groups: filteredCustomerReportGroups,
        grandTotals: customerGrandTotals
      });
      return;
    }

    if (activeTab === 'sales') {
      const validSalesTrx = filteredTransactions.filter((t) => {
        const itemsSum = (t.items || []).reduce(
          (s, it) => s + (Number(it.subtotal_item) || (Number(it.price_applied) || 0) * (Number(it.qty) || 1)),
          0
        );
        return (Number(t.grand_total) || Number(t.subtotal) || itemsSum) > 0 || (t.items && t.items.length > 0);
      });

      exportReportToExcel({
        title: 'LAPORAN REKAPITULASI PENJUALAN & SHIFT KASIR',
        periodText: periodLabel,
        storeProfile,
        filename: `Laporan_Penjualan_${dateSlug}.xls`,
        sheetName: `Laporan Penjualan`,
        columnWidths: [42, 155, 140, 210, 165, 105, 420, 75, 120, 110, 130],
        kpis: [
          { label: 'Total Transaksi', value: `${validSalesTrx.length} Nota`, sublabel: `${metrics.totalItems} Pcs Terjual` },
          { label: 'Penjualan Bersih', value: formatRupiah(metrics.totalNetRevenue), highlight: true },
          { label: 'Potong Saldo Member', value: formatRupiah(metrics.paymentMethodMap.SALDO || 0), sublabel: `${metrics.paymentCountMap.SALDO || 0} Nota Saldo` },
          { label: 'Penjualan Tunai (CASH)', value: formatRupiah(metrics.paymentMethodMap.CASH || 0), sublabel: `${metrics.paymentCountMap.CASH || 0} Nota Tunai` },
          { label: 'Transfer & QRIS/Debit', value: formatRupiah((metrics.paymentMethodMap.TRANSFER || 0) + (metrics.paymentMethodMap.QRIS || 0) + (metrics.paymentMethodMap.DEBIT || 0)), sublabel: `${(metrics.paymentCountMap.TRANSFER || 0) + (metrics.paymentCountMap.QRIS || 0) + (metrics.paymentCountMap.DEBIT || 0)} Nota Non-Tunai` }
        ],
        table: {
          headers: [
            'No',
            'No. Nota',
            'Waktu Transaksi',
            'Pelanggan / Karyawan',
            'Kasir / Petugas',
            'Metode Bayar',
            'Rincian Barang Dibeli',
            'Item',
            'Subtotal',
            'Diskon',
            'Total Bayar'
          ],
          rows: validSalesTrx.map((t, idx) => {
            const itemsSum = (t.items || []).reduce(
              (s, it) => s + (Number(it.subtotal_item) || (Number(it.price_applied) || 0) * (Number(it.qty) || 1)),
              0
            );
            const effSub = Number(t.subtotal) > 0 ? Number(t.subtotal) : itemsSum;
            const effTotal =
              Number(t.grand_total) > 0
                ? Number(t.grand_total)
                : Math.max(0, effSub - (Number(t.discount_amount) || 0) + (Number(t.tax_amount) || 0));
            const itemsText = (t.items || []).map((it) => `${it.qty}x ${it.product_name}`).join(', ') || '-';
            return [
              idx + 1,
              t.receipt_number,
              new Date(t.created_at).toLocaleString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }),
              t.customer_name || 'Pelanggan Umum',
              t.cashier_name || cashierName,
              t.payment_method,
              itemsText,
              `${t.items.reduce((s, it) => s + it.qty, 0)} Pcs`,
              formatRupiah(effSub),
              t.discount_amount ? '-' + formatRupiah(t.discount_amount) : 'Rp 0',
              formatRupiah(effTotal)
            ];
          }),
          alignments: ['center', 'left', 'center', 'left', 'left', 'center', 'left', 'center', 'right', 'right', 'right'],
          footers: [
            'TOTAL',
            `${validSalesTrx.length} Nota`,
            '',
            '',
            '',
            '',
            '',
            `${metrics.totalItems} Pcs`,
            formatRupiah(metrics.totalGrossRevenue),
            metrics.totalDiscount ? '-' + formatRupiah(metrics.totalDiscount) : 'Rp 0',
            formatRupiah(metrics.totalNetRevenue)
          ]
        }
      });
      return;
    }

    if (activeTab === 'products') {
      exportReportToExcel({
        title: 'LAPORAN PENJUALAN PER PRODUK & SKU',
        periodText: periodLabel,
        storeProfile,
        filename: `Laporan_Produk_Terjual_${dateSlug}.xls`,
        sheetName: 'Produk Terjual',
        columnWidths: [45, 130, 280, 140, 100, 140, 140],
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
      return;
    }

    if (activeTab === 'profit') {
      exportReportToExcel({
        title: 'LAPORAN LABA RUGI KOMPREHENSIF (P&L STATEMENT)',
        periodText: periodLabel,
        storeProfile,
        filename: `Laporan_Laba_Rugi_${dateSlug}.xls`,
        sheetName: 'Laba Rugi',
        columnWidths: [300, 180, 120, 160],
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
        }
      });
      return;
    }

    if (activeTab === 'inventory') {
      exportReportToExcel({
        title: 'LAPORAN VALUASI NILAI STOK & ASET INVENTORI',
        periodText: 'Posisi Per ' + new Date().toLocaleString('id-ID'),
        storeProfile,
        filename: `Laporan_Stok_Inventori_${dateSlug}.xls`,
        sheetName: 'Stok Inventori',
        columnWidths: [45, 130, 280, 140, 95, 130, 130, 145, 95],
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
      return;
    }

    exportReportToExcel({
      title: 'LAPORAN REKAPITULASI METODE PEMBAYARAN & SETTLEMENT',
      periodText: periodLabel,
      storeProfile,
      filename: `Laporan_Metode_Pembayaran_${dateSlug}.xls`,
      sheetName: 'Metode Pembayaran',
      columnWidths: [45, 260, 180, 140],
      kpis: [
        { label: 'Total Pembayaran', value: formatRupiah(metrics.totalNetRevenue), highlight: true },
        { label: 'Potong Saldo Member', value: formatRupiah(metrics.paymentMethodMap['SALDO'] || 0) },
        { label: 'Total Tunai (Cash)', value: formatRupiah(metrics.paymentMethodMap['CASH'] || 0) },
        { label: 'Transfer & QRIS/Debit', value: formatRupiah((metrics.paymentMethodMap['TRANSFER'] || 0) + (metrics.paymentMethodMap['QRIS'] || 0) + (metrics.paymentMethodMap['DEBIT'] || 0)) }
      ],
      table: {
        headers: ['No', 'Metode Pembayaran', 'Total Penerimaan Kasir (Rp)', 'Porsi Kontribusi (%)'],
        rows: Object.entries(metrics.paymentMethodMap).map(([method, amount], idx) => [
          idx + 1,
          method === 'CASH'
            ? 'Tunai (Cash Physical)'
            : method === 'SALDO'
              ? 'Potong Saldo Anggota / Karyawan'
              : method === 'QRIS'
                ? 'QRIS Digital Settlement'
                : method === 'DEBIT'
                  ? 'Kartu Debit / EDC'
                  : method === 'TRANSFER'
                    ? 'Transfer Bank Direct'
                    : method,
          formatRupiah(amount),
          `${(metrics.totalNetRevenue > 0 ? (amount / metrics.totalNetRevenue) * 100 : 0).toFixed(1)}%`
        ]),
        alignments: ['center', 'left', 'right', 'center'],
        footers: ['TOTAL SETTLEMENT', 'SEMUA SALURAN PEMBAYARAN', formatRupiah(metrics.totalNetRevenue), '100.0%']
      }
    });
  };

  // Export active report (diarahkan ke format Excel .xls rapi agar tidak berantakan di kolom A)
  const handleExportCSV = () => {
    handleExportExcel();
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
    <div className="fixed inset-0 z-50 bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
        
        {/* 1. Full-Screen Workspace Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-[#5e3519] bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-[#543017] text-amber-200 shadow-inner border border-[#9b663b]/50 hidden sm:flex">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-base sm:text-xl leading-tight tracking-tight text-white">
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
              <p className="text-xs text-[#fcefe3]/90 font-medium mt-0.5 hidden sm:block">
                Rekapitulasi laba rugi komprehensif, penjualan, margin HPP, persediaan, dan beban operasional
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
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

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs active:scale-95 border border-emerald-500/50 whitespace-nowrap"
              title="Unduh Laporan Aktif dalam Format Microsoft Excel Rapi (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span className="hidden md:inline">Export Excel (.xls)</span>
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
              className="px-3.5 py-2 rounded-xl bg-[#543017] hover:bg-[#422511] text-white text-xs font-bold flex items-center space-x-1.5 border border-[#9b663b]/50 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* 2. Responsive Tab & Date Range Selector - Full Width Bar (No Horizontal Scrollbar) */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-[#e4d5c7] bg-[#f5ece3] flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Tab Navigation Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
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

            <button
              onClick={() => setActiveTab('customer_items')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center space-x-1.5 shadow-2xs active:scale-95 ${
                activeTab === 'customer_items'
                  ? 'bg-[#7c4e2f] text-white border-[#7c4e2f] shadow-xs'
                  : 'bg-white text-[#543c2e] hover:bg-[#faebd7] border-[#dfcebe]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>Laporan Pelanggan</span>
            </button>

            <button
              onClick={() => setActiveTab('employee_allowance')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center space-x-1.5 shadow-2xs active:scale-95 ${
                activeTab === 'employee_allowance'
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border-emerald-300'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saldo & Kuota Karyawan</span>
            </button>
          </div>

          {/* Quick Date Presets + Target Date Picker */}
          <div className="flex flex-wrap items-center gap-1 bg-white/80 p-1 rounded-xl border border-[#dfcebe] text-xs font-bold self-start sm:self-auto shadow-2xs">
            <span className="text-[#856b59] px-2 flex items-center space-x-1 text-[11px]">
              <Calendar className="w-3 h-3 text-[#7c4e2f]" />
              <span>Periode:</span>
            </span>

            <button
              onClick={() => {
                setDateFilter('today');
                setTargetDate(todayStr);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                dateFilter === 'today' ? 'bg-[#2d5a40] text-white shadow-2xs' : 'text-[#543c2e] hover:bg-[#ebdccf]'
              }`}
            >
              Hari Ini
            </button>

            <button
              onClick={() => {
                setDateFilter('yesterday');
                setTargetDate(yesterdayStr);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                dateFilter === 'yesterday' ? 'bg-[#2d5a40] text-white shadow-2xs' : 'text-[#543c2e] hover:bg-[#ebdccf]'
              }`}
            >
              Kemarin
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
              Rentang
            </button>

            <div className="flex items-center space-x-1 pl-1.5 ml-1 border-l border-[#dfcebe]">
              <span className="text-[10px] font-extrabold text-[#7c4e2f] uppercase">Tgl:</span>
              <input
                type="date"
                value={dateFilter === 'today' ? todayStr : dateFilter === 'yesterday' ? yesterdayStr : targetDate}
                onChange={(e) => {
                  const picked = e.target.value;
                  if (!picked) return;
                  setTargetDate(picked);
                  setStartDate(picked);
                  setEndDate(picked);
                  if (picked === todayStr) {
                    setDateFilter('today');
                  } else if (picked === yesterdayStr) {
                    setDateFilter('yesterday');
                  } else {
                    setDateFilter('date');
                  }
                }}
                className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold focus:outline-none ${
                  dateFilter === 'date'
                    ? 'bg-[#2d5a40] text-white border-[#2d5a40]'
                    : 'bg-[#fcf9f5] text-[#332219] border-[#dfcebe] focus:border-[#2d5a40]'
                }`}
                title="Pilih tanggal laporan yang dituju"
              />
            </div>
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

        {/* 3. Full-Screen Body: Tab Content Container */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto space-y-6 flex-1 bg-[#fcf9f5]">
          
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

              {/* Rincian Detail Penjualan: CASH vs SALDO vs TRANSFER (TF) / Non-Tunai */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-[#faebd7] text-[#7c4e2f]">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-[#332219]">Rincian Metode Pembayaran ({periodFormattedHeader})</h4>
                      <p className="text-[11px] text-[#856b59]">Detail pembagian omset penjualan antara Tunai (Cash), Potong Saldo Member, Transfer Bank (TF), QRIS & Debit</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#7c4e2f] bg-[#f5ece3] px-3 py-1 rounded-xl border border-[#dfcebe] self-start sm:self-auto">
                    Total: {formatRupiah(metrics.totalNetRevenue)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
                  {/* CASH Card */}
                  <div className="p-4 rounded-2xl bg-[#f7faf7] border border-[#cce2cf] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-[#166534] mb-1">
                      <span className="text-xs font-black uppercase flex items-center whitespace-nowrap">
                        <Banknote className="w-3.5 h-3.5 mr-1 shrink-0" /> Tunai (CASH)
                      </span>
                      <span className="text-[10px] tabular-nums font-bold bg-white px-2 py-0.5 rounded-md border border-[#cce2cf] whitespace-nowrap shrink-0">
                        {metrics.paymentCountMap.CASH} Nota
                      </span>
                    </div>
                    <div className="text-xl font-black tabular-nums text-[#166534] mt-1">
                      {formatRupiah(metrics.paymentMethodMap.CASH)}
                    </div>
                    <div className="text-[10px] text-[#856b59] mt-1 font-medium">
                      {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.CASH / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total omset
                    </div>
                  </div>

                  {/* POTONG SALDO Card */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-amber-900 mb-1">
                      <span className="text-xs font-black uppercase flex items-center whitespace-nowrap">
                        <Wallet className="w-3.5 h-3.5 mr-1 shrink-0" /> Potong Saldo
                      </span>
                      <span className="text-[10px] tabular-nums font-bold bg-white px-2 py-0.5 rounded-md border border-amber-200 whitespace-nowrap shrink-0">
                        {metrics.paymentCountMap.SALDO} Nota
                      </span>
                    </div>
                    <div className="text-xl font-black tabular-nums text-amber-900 mt-1">
                      {formatRupiah(metrics.paymentMethodMap.SALDO)}
                    </div>
                    <div className="text-[10px] text-[#856b59] mt-1 font-medium">
                      {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.SALDO / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total omset
                    </div>
                  </div>

                  {/* TRANSFER Card */}
                  <div className="p-4 rounded-2xl bg-[#fcf8f4] border border-[#eed7c4] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-[#7c4e2f] mb-1">
                      <span className="text-xs font-black uppercase flex items-center whitespace-nowrap">
                        <DollarSign className="w-3.5 h-3.5 mr-1 shrink-0" /> Transfer (TF)
                      </span>
                      <span className="text-[10px] tabular-nums font-bold bg-white px-2 py-0.5 rounded-md border border-[#eed7c4] whitespace-nowrap shrink-0">
                        {metrics.paymentCountMap.TRANSFER} Nota
                      </span>
                    </div>
                    <div className="text-xl font-black tabular-nums text-[#7c4e2f] mt-1">
                      {formatRupiah(metrics.paymentMethodMap.TRANSFER)}
                    </div>
                    <div className="text-[10px] text-[#856b59] mt-1 font-medium">
                      {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.TRANSFER / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total omset
                    </div>
                  </div>

                  {/* QRIS Card */}
                  <div className="p-4 rounded-2xl bg-[#f0f7fb] border border-[#bae6fd] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-[#0369a1] mb-1">
                      <span className="text-xs font-black uppercase flex items-center whitespace-nowrap">
                        <QrCode className="w-3.5 h-3.5 mr-1 shrink-0" /> QRIS Digital
                      </span>
                      <span className="text-[10px] tabular-nums font-bold bg-white px-2 py-0.5 rounded-md border border-[#bae6fd] whitespace-nowrap shrink-0">
                        {metrics.paymentCountMap.QRIS} Nota
                      </span>
                    </div>
                    <div className="text-xl font-black tabular-nums text-[#0369a1] mt-1">
                      {formatRupiah(metrics.paymentMethodMap.QRIS)}
                    </div>
                    <div className="text-[10px] text-[#856b59] mt-1 font-medium">
                      {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.QRIS / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total omset
                    </div>
                  </div>

                  {/* DEBIT Card */}
                  <div className="p-4 rounded-2xl bg-[#faf5ff] border border-[#e9d5ff] flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-[#6b21a8] mb-1">
                      <span className="text-xs font-black uppercase flex items-center whitespace-nowrap">
                        <CreditCard className="w-3.5 h-3.5 mr-1 shrink-0" /> Kartu Debit (EDC)
                      </span>
                      <span className="text-[10px] tabular-nums font-bold bg-white px-2 py-0.5 rounded-md border border-[#e9d5ff] whitespace-nowrap shrink-0">
                        {metrics.paymentCountMap.DEBIT} Nota
                      </span>
                    </div>
                    <div className="text-xl font-black tabular-nums text-[#6b21a8] mt-1">
                      {formatRupiah(metrics.paymentMethodMap.DEBIT)}
                    </div>
                    <div className="text-[10px] text-[#856b59] mt-1 font-medium">
                      {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.DEBIT / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total omset
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="p-5 rounded-3xl bg-white border border-[#e4d5c7] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-[#332219]">Daftar Transaksi Kasir Terakhir</h4>
                  <span className="text-xs text-[#856b59] font-medium">{filteredTransactions.length} Transaksi Ditemukan</span>
                </div>

                <div className="overflow-x-auto max-h-[65vh] border border-[#f0e4d7] rounded-2xl custom-scroll">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] z-10">
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
                      {filteredTransactions.slice(0, 50).map((trx) => (
                        <tr key={trx.id} className="hover:bg-[#fcf8f4] transition-colors">
                          <td className="py-2.5 px-4 text-[#856b59] whitespace-nowrap font-mono text-[11px]">
                            {new Date(trx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                            {new Date(trx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-[#332219] whitespace-nowrap">
                            {trx.receipt_number}
                          </td>
                          <td className="py-2.5 px-4 text-[#543c2e] whitespace-nowrap">{trx.cashier_name || 'Kasir'}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                              trx.payment_method === 'CASH'
                                ? 'bg-[#edf5ee] text-[#166534] border-[#cce2cf]'
                                : trx.payment_method === 'SALDO'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-[#faebd7] text-[#7c4e2f] border-[#eed7c4]'
                            }`}>
                              {trx.payment_method === 'SALDO' ? 'POTONG SALDO' : trx.payment_method}
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
                    <thead className="sticky top-0 bg-[#f5ece3] z-10">
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

                <div className="overflow-x-auto max-h-[65vh] border border-[#f0e4d7] rounded-2xl custom-scroll">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] z-10">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
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
                    {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.CASH / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total ({metrics.paymentCountMap.CASH} Nota)
                  </span>
                </div>

                <div 
                  onClick={() => setPaymentFilterMethod(paymentFilterMethod === 'SALDO' ? 'ALL' : 'SALDO')}
                  className={`p-4 rounded-3xl bg-white border shadow-xs cursor-pointer transition-all ${
                    paymentFilterMethod === 'SALDO' ? 'border-amber-700 ring-2 ring-amber-700/20 shadow-sm' : 'border-[#e4d5c7] hover:border-[#b8957c]'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-amber-800 mb-1.5">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Potong Saldo</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[#332219] whitespace-nowrap">
                    {formatRupiah(metrics.paymentMethodMap.SALDO)}
                  </div>
                  <span className="text-[11px] text-[#856b59] mt-1 block font-medium">
                    {metrics.totalNetRevenue > 0 ? ((metrics.paymentMethodMap.SALDO / metrics.totalNetRevenue) * 100).toFixed(1) : 0}% dari total ({metrics.paymentCountMap.SALDO} Nota)
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

                <div className="overflow-x-auto max-h-[65vh] border border-[#f0e4d7] rounded-2xl custom-scroll">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#f5ece3] z-10">
                      <tr className="border-b border-[#dfcebe] text-[#543c2e] text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">No. Invoice</th>
                        <th className="py-3 px-4">Pelanggan</th>
                        <th className="py-3 px-4">Kasir</th>
                        <th className="py-3 px-4 text-center">Metode</th>
                        <th className="py-3 px-4 text-right">Jumlah Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e4d7] font-medium">
                      {filteredTransactions
                        .filter((t) => paymentFilterMethod === 'ALL' || t.payment_method === paymentFilterMethod)
                        .slice(0, 50)
                        .map((trx) => (
                          <tr key={trx.id} className="hover:bg-[#fcf8f4] transition-colors">
                            <td className="py-2.5 px-4 text-[#856b59] font-mono text-[11px] whitespace-nowrap">
                              {new Date(trx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                              {new Date(trx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-[#332219] whitespace-nowrap">{trx.receipt_number}</td>
                            <td className="py-2.5 px-4 text-[#332219] font-medium">{trx.customer_name || 'Pelanggan Umum'}</td>
                            <td className="py-2.5 px-4 text-[#543c2e] whitespace-nowrap">{trx.cashier_name || 'Kasir'}</td>
                            <td className="py-2.5 px-4 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                trx.payment_method === 'CASH'
                                  ? 'bg-[#edf5ee] text-[#166534] border-[#cce2cf]'
                                  : trx.payment_method === 'SALDO'
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : trx.payment_method === 'TRANSFER'
                                  ? 'bg-[#fcf5ed] text-[#7c4e2f] border-[#eed7c4]'
                                  : trx.payment_method === 'QRIS'
                                  ? 'bg-[#f0f7fb] text-[#0369a1] border-[#bae6fd]'
                                  : 'bg-[#faf5ff] text-[#6b21a8] border-[#e9d5ff]'
                              }`}>
                                {trx.payment_method === 'SALDO' ? 'POTONG SALDO' : trx.payment_method}
                              </span>
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

          {/* TAB 6: LAPORAN PELANGGAN & BARANG (MATCHES USER SPREADSHEET PHOTO) */}
          {activeTab === 'customer_items' && (
            <div className="space-y-6">
              {/* Filter & Summary Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#e4d5c7] shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Customer Filter */}
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-bold text-[#856b59] whitespace-nowrap">Pelanggan:</label>
                    <CustomSelect
                      value={selectedCustomerFilter}
                      onChange={(val) => setSelectedCustomerFilter(val)}
                      size="sm"
                      className="min-w-[220px]"
                      options={[
                        { value: 'ALL', label: `Semua Pelanggan (${allCustomerNames.length})` },
                        ...allCustomerNames.map((name) => ({ value: name, label: name }))
                      ]}
                    />
                  </div>

                  {/* Search Filter */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari pelanggan / barang..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="w-56 pl-8 pr-3 py-1.5 rounded-xl border border-[#d6c4b2] text-xs font-medium text-[#332219] bg-[#fbf7f4] focus:outline-none focus:ring-2 focus:ring-[#7c4e2f]"
                    />
                    <Search className="w-3.5 h-3.5 text-[#856b59] absolute left-2.5 top-2" />
                    {customerSearchTerm && (
                      <button
                        onClick={() => setCustomerSearchTerm('')}
                        className="absolute right-2 top-1.5 text-xs text-[#856b59] hover:text-[#332219]"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                    title="Export ke file Microsoft Excel (.xls)"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#d6c4b2] hover:bg-[#fbf7f4] text-[#332219] text-xs font-bold transition-all"
                    title="Export ke file CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-[#856b59]" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#d6c4b2] hover:bg-[#fbf7f4] text-[#332219] text-xs font-bold transition-all"
                    title="Cetak Laporan PDF Resmi"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#856b59]" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              {/* Summary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#856b59]">Total Pelanggan</div>
                  <div className="text-xl font-black text-[#332219] mt-1">
                    {filteredCustomerReportGroups.length} <span className="text-xs font-semibold text-[#856b59]">Orang/Akun</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#856b59]">Total Kuantitas</div>
                  <div className="text-xl font-black text-[#332219] mt-1 font-mono">
                    {customerGrandTotals.qty.toLocaleString('id-ID')}, <span className="text-xs font-semibold text-[#856b59]">Item</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#be185d]">Total Modal (HPP)</div>
                  <div className="text-xl font-black text-[#be185d] mt-1 font-mono">
                    {formatRupiah(customerGrandTotals.modal)}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] shadow-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8]">Total Penjualan</div>
                  <div className="text-xl font-black text-[#1d4ed8] mt-1 font-mono">
                    {formatRupiah(customerGrandTotals.sales)}
                  </div>
                </div>
              </div>

              {/* Table Container - Exact Match to Reference Photo */}
              <div className="bg-white rounded-2xl border border-[#b2cde8] shadow-sm overflow-hidden">
                <div className="py-2.5 px-4 bg-[#e8f1fc] border-b border-[#b2cde8] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-[#1d4ed8]" />
                    <span className="text-xs font-black text-[#1e3a8a] uppercase tracking-wider">
                      Laporan Penjualan Per Pelanggan & Barang
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#1e40af] bg-[#dbeafe] px-2.5 py-0.5 rounded-full border border-[#bfdbfe]">
                    {periodFormattedHeader}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[#cbe4fc] text-[#1e3a8a] border-b border-[#a6c8ea] font-bold text-center">
                        <th className="py-2.5 px-4 text-left border-r border-[#a6c8ea] w-48">Pelanggan</th>
                        <th className="py-2.5 px-4 text-left border-r border-[#a6c8ea]">Nama Barang</th>
                        <th className="py-2.5 px-4 text-right border-r border-[#a6c8ea] w-32 text-[#be185d]">Modal</th>
                        <th className="py-2.5 px-4 text-right border-r border-[#a6c8ea] w-24">Kuantitas</th>
                        <th className="py-2.5 px-4 text-right border-r border-[#a6c8ea] w-32">Harga Satuan</th>
                        <th className="py-2.5 px-4 text-right w-36">Penjualan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d4e4f7]">
                      {filteredCustomerReportGroups.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-[#856b59]">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#1e3a8a]" />
                            <p className="font-bold">Tidak ada data transaksi pelanggan pada periode ini</p>
                            <p className="text-[11px] opacity-75 mt-0.5">Ubah filter periode tanggal atau kata kunci pencarian</p>
                          </td>
                        </tr>
                      ) : (
                        filteredCustomerReportGroups.map((group) => (
                          <React.Fragment key={group.customer_name}>
                            {group.items.map((item, itemIdx) => (
                              <tr
                                key={`${group.customer_name}-${item.product_name}-${itemIdx}`}
                                className="hover:bg-[#f0f7ff] transition-colors"
                              >
                                {itemIdx === 0 ? (
                                  <td
                                    rowSpan={group.items.length}
                                    className="py-2.5 px-4 font-bold text-[#1e3a8a] align-top border-r border-[#d4e4f7] bg-[#f8fbff]"
                                  >
                                    <div className="sticky top-0">
                                      <span className="font-extrabold tracking-wide">{group.customer_name}</span>
                                      <div className="text-[10px] text-[#6b7280] font-normal">
                                        {group.items.length} macam barang
                                      </div>
                                    </div>
                                  </td>
                                ) : null}
                                <td className="py-2 px-4 text-[#1f2937] border-r border-[#d4e4f7] font-medium">
                                  {item.product_name}
                                </td>
                                <td className="py-2 px-4 text-right font-mono text-[#be185d] border-r border-[#d4e4f7]">
                                  {item.modal > 0 ? `${Math.round(item.modal).toLocaleString('id-ID')},` : ''}
                                </td>
                                <td className="py-2 px-4 text-right font-mono font-medium text-[#111827] border-r border-[#d4e4f7]">
                                  {item.qty.toLocaleString('id-ID')},
                                </td>
                                <td className="py-2 px-4 text-right font-mono text-[#374151] border-r border-[#d4e4f7]">
                                  {item.unit_price > 0 ? `${Math.round(item.unit_price).toLocaleString('id-ID')},` : ''}
                                </td>
                                <td className="py-2 px-4 text-right font-mono font-semibold text-[#111827]">
                                  {`${Math.round(item.sales).toLocaleString('id-ID')},`}
                                </td>
                              </tr>
                            ))}

                            {/* Subtotal Per Pelanggan Row (Exact blue row from user reference) */}
                            <tr className="bg-[#cbe4fc] font-bold text-[#1e3a8a] border-t border-b border-[#a6c8ea]">
                              <td className="py-2 px-4 border-r border-[#a6c8ea] text-left">
                                <span className="opacity-0">{group.customer_name}</span>
                              </td>
                              <td className="py-2 px-4 border-r border-[#a6c8ea] font-black text-[#1e3a8a]">
                                Total Nama Barang
                              </td>
                              <td className="py-2 px-4 text-right font-mono border-r border-[#a6c8ea] text-[#be185d]">
                                {group.total_modal > 0 ? `${Math.round(group.total_modal).toLocaleString('id-ID')},` : ''}
                              </td>
                              <td className="py-2 px-4 text-right font-mono border-r border-[#a6c8ea] font-black text-[#1e3a8a]">
                                {`${group.total_qty.toLocaleString('id-ID')},`}
                              </td>
                              <td className="py-2 px-4 text-right border-r border-[#a6c8ea]"></td>
                              <td className="py-2 px-4 text-right font-mono font-black text-[#1e3a8a]">
                                {`${Math.round(group.total_sales).toLocaleString('id-ID')},`}
                              </td>
                            </tr>
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                    {filteredCustomerReportGroups.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#93c5fd] font-black text-[#1e3a8a] border-t-2 border-[#1e40af]">
                          <td className="py-3 px-4 uppercase text-xs tracking-wider border-r border-[#60a5fa]">
                            GRAND TOTAL
                          </td>
                          <td className="py-3 px-4 text-xs border-r border-[#60a5fa]">
                            {filteredCustomerReportGroups.length} Pelanggan
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[#9d174d] border-r border-[#60a5fa]">
                            {customerGrandTotals.modal > 0 ? `${Math.round(customerGrandTotals.modal).toLocaleString('id-ID')},` : ''}
                          </td>
                          <td className="py-3 px-4 text-right font-mono border-r border-[#60a5fa]">
                            {`${customerGrandTotals.qty.toLocaleString('id-ID')},`}
                          </td>
                          <td className="py-3 px-4 text-right border-r border-[#60a5fa]">-</td>
                          <td className="py-3 px-4 text-right font-mono text-sm">
                            {`${Math.round(customerGrandTotals.sales).toLocaleString('id-ID')},`}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REKAPITULASI KUOTA & SALDO KARYAWAN KOPERASI (1.500 Karyawan, Rp 2 Jt) */}
          {activeTab === 'employee_allowance' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Summary Header & Info Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white shadow-md border border-emerald-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="p-3 rounded-2xl bg-emerald-800/80 text-emerald-200 border border-emerald-600/50 shadow-inner">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h4 className="font-black text-lg text-white tracking-tight">
                        Rekapitulasi Saldo & Kuota Karyawan Koperasi
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-800 text-emerald-200 border border-emerald-500/50 uppercase tracking-wider">
                        Periode: {employeeReport?.period_name || new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100 font-medium mt-0.5">
                      Sistem kuota belanja bulanan Rp 2.000.000 per karyawan. Auto-reset tiap tanggal 1 awal bulan dan akses kartu digital via HP.
                    </p>
                  </div>
                </div>

                {/* Quick Action Export Excel, Reset All & Print Afdeling Payroll */}
                <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 border border-emerald-400/50"
                    title="Unduh Laporan Saldo Karyawan format Microsoft Excel (.xls) rapi siap cetak"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                    <span>📊 Export Excel Rapi (.xls)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const savedStore = localStorage.getItem('ketoko_store_profile');
                      const sp: StoreProfile | undefined = savedStore ? JSON.parse(savedStore) : undefined;
                      employeeAllowanceService.printAfdelingSummaryReport(
                        afdelingSummaries,
                        employeeReport?.monthFormatted || 'November 2026',
                        sp?.name || 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI'
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 border border-emerald-600/50"
                    title="Cetak format A4 Rekapitulasi Pemakaian Belanja per Afdeling untuk Bagian Payroll / HRD"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-300" />
                    <span>🖨️ Cetak Rekap Payroll Afdeling</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreBalancesFromTransactions}
                    disabled={isResettingEmployees}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 border border-sky-400/50 disabled:opacity-50"
                    title="Jika terjadi salah klik Reset Saldo, tombol ini menghitung ulang Sisa Saldo = Rp 2.000.000 - Total Belanja Potong Saldo Bulan Ini dari nota transaksi kasir"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 text-sky-100 ${isResettingEmployees ? 'animate-spin' : ''}`} />
                    <span>🛠️ Pulihkan Saldo dari Transaksi</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetAllEmployeesFromReport}
                    disabled={isResettingEmployees}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                    title="Reset saldo seluruh karyawan ke Rp 2.000.000"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-100 ${isResettingEmployees ? 'animate-spin' : ''}`} />
                    <span>{isResettingEmployees ? 'Memproses...' : '🔄 Reset Semua ke Rp 2 Jt'}</span>
                  </button>
                </div>
              </div>

              {/* 6 KPI Summary Cards (Termasuk Laporan Pembelian Cash Member) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total Karyawan */}
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#856b59]">Total Karyawan</span>
                  <div className="text-2xl font-black text-[#332219] mt-2">
                    {employeeReport?.summary.total_employees.toLocaleString('id-ID') || 0}
                    <span className="text-xs font-semibold text-[#856b59] ml-1">Orang</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium mt-1">
                    {employeeReport?.summary.exhausted_count || 0} kuota habis
                  </div>
                </div>

                {/* Total Plafon Anggaran */}
                <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#856b59]">Total Plafon Kuota</span>
                  <div className="text-lg sm:text-xl font-black font-mono text-[#332219] mt-2">
                    {formatRupiah(employeeReport?.summary.total_allowance_budget || 0)}
                  </div>
                  <div className="text-[10px] text-stone-500 font-medium mt-1">
                    Default Rp 2.000.000 / bln
                  </div>
                </div>

                {/* Total Kuota Terpakai */}
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Potong Saldo / Gaji</span>
                  <div className="text-lg sm:text-xl font-black font-mono text-rose-900 mt-2">
                    {formatRupiah(employeeReport?.summary.total_spent || 0)}
                  </div>
                  <div className="text-[10px] text-rose-700 font-medium mt-1">
                    Belanja potong saldo bulan ini
                  </div>
                </div>

                {/* Total Belanja Cash Member */}
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 shadow-xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Belanja Cash Member</span>
                  <div className="text-lg sm:text-xl font-black font-mono text-sky-900 mt-2">
                    {formatRupiah(employeeReport?.summary.total_cash_spent || 0)}
                  </div>
                  <div className="text-[10px] text-sky-700 font-medium mt-1">
                    {employeeReport?.summary.cash_shopper_count || 0} org beli cash (saldo utuh)
                  </div>
                </div>

                {/* Sisa Saldo Tersedia */}
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Sisa Saldo Kuota</span>
                  <div className="text-lg sm:text-xl font-black font-mono text-emerald-900 mt-2">
                    {formatRupiah(employeeReport?.summary.total_remaining_balance || 0)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium mt-1">
                    Bisa dibelanjakan di kasir
                  </div>
                </div>

                {/* % Utilisasi Saldo */}
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Tingkat Penyerapan</span>
                  <div className="text-2xl font-black font-mono text-indigo-900 mt-2">
                    {employeeReport?.summary.utilization_rate || 0}%
                  </div>
                  <div className="w-full bg-indigo-200 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(employeeReport?.summary.utilization_rate || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Toolbar & Filter Karyawan */}
              <div className="p-4 rounded-2xl bg-white border border-[#e4d5c7] shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-64 sm:w-80">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      placeholder="Cari NIK, nama karyawan, nomor HP..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs font-medium focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-stone-50"
                    />
                  </div>

                  <input
                    type="month"
                    value={employeeMonth}
                    max={employeeAllowanceService.getCurrentMonthKey()}
                    onChange={(e) => setEmployeeMonth(e.target.value || employeeAllowanceService.getCurrentMonthKey())}
                    title="Pilih periode bulan (histori potong gaji bulan lalu tetap utuh walau saldo sudah di-reset Tgl 1)"
                    className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-xs font-bold text-amber-950 focus:border-amber-600"
                  />

                  <CustomSelect
                    value={employeeStatusFilter}
                    onChange={(val) => setEmployeeStatusFilter(val as any)}
                    className="min-w-[210px]"
                    options={[
                      { value: 'ALL', label: `Semua Status (${employeeReport?.employees.length || 0})` },
                      { value: 'SHOPPED', label: `💳 Potong Saldo / Gaji (${employeeReport?.employees.filter((e: EmployeeAllowanceRecord) => e.spent_this_month > 0).length || 0})` },
                      { value: 'CASH_SHOPPED', label: `💵 Belanja Cash / Tunai (${employeeReport?.employees.filter((e: EmployeeAllowanceRecord) => (e.cash_spent_this_month || 0) > 0).length || 0})` },
                      { value: 'NOT_SHOPPED', label: `⚪ Belum Belanja (${employeeReport?.employees.filter((e: EmployeeAllowanceRecord) => e.spent_this_month <= 0 && (e.cash_spent_this_month || 0) <= 0).length || 0})` },
                      { value: 'ACTIVE', label: `🟢 Masih Ada Kuota (${employeeReport?.employees.filter((e: EmployeeAllowanceRecord) => e.status === 'ACTIVE').length || 0})` },
                      { value: 'EXHAUSTED', label: `🔴 Kuota Habis (Rp 0) (${employeeReport?.summary.exhausted_count || 0})` }
                    ]}
                  />

                  {/* Filter Afdeling */}
                  <CustomSelect
                    value={employeeAfdelingFilter}
                    onChange={(val) => setEmployeeAfdelingFilter(val)}
                    variant="emerald"
                    className="min-w-[200px]"
                    options={[
                      { value: 'ALL', label: `Semua Afdeling (${employeeReport?.employees.length || 0})` },
                      ...afdelingOptions.map((afd) => {
                        const count = (employeeReport?.employees || []).filter(
                          (e) => (e.afdeling || 'UMUM').toUpperCase() === afd
                        ).length;
                        return { value: afd, label: `Afdeling ${afd} (${count} Org)` };
                      })
                    ]}
                  />

                  <button
                    type="button"
                    onClick={() => setShowAfdelingSummaryTable(prev => !prev)}
                    className="px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    {showAfdelingSummaryTable ? '📊 Sembunyikan Rekap Afdeling' : '📊 Tampilkan Rekap Afdeling'}
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-stone-500 font-medium">
                    Menampilkan <b>{filteredEmployees.length}</b> dari {employeeReport?.summary.total_employees || 0} Karyawan
                  </span>
                </div>
              </div>

              {/* Tabel Ringkasan Pemakaian Per Afdeling (Dasar Potongan Payroll HRD) */}
              {showAfdelingSummaryTable && (
                <div className="bg-white rounded-2xl border border-emerald-300 shadow-sm overflow-hidden animate-fadeIn">
                  <div className="py-2.5 px-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">📋</span>
                      <span className="text-xs font-black uppercase tracking-wider">
                        Rekapitulasi Pemakaian Kuota Belanja Per Afdeling (Dasar Potong Gaji Payroll)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full text-emerald-100">
                      Total: {afdelingSummaries.length} Divisi/Afdeling
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="sticky top-0 bg-[#e6f4ea] text-emerald-950 z-10 font-bold border-b border-emerald-200">
                        <tr>
                          <th className="py-2 px-3 text-center w-12">No</th>
                          <th className="py-2 px-3 text-left">Unit Kerja</th>
                          <th className="py-2 px-4 text-left">Afdeling / Divisi</th>
                          <th className="py-2 px-3 text-center">Jumlah Karyawan</th>
                          <th className="py-2 px-3 text-right">Total Plafon</th>
                          <th className="py-2 px-3 text-right text-rose-700">Potong Saldo / Gaji</th>
                          <th className="py-2 px-3 text-right text-sky-700">Beli Cash (Tunai)</th>
                          <th className="py-2 px-3 text-right text-emerald-800">Sisa Saldo</th>
                          <th className="py-2 px-3 text-center">Penyerapan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100 font-medium">
                        {afdelingSummaries.map((s, idx) => (
                          <tr key={idx} className="hover:bg-emerald-50/60 transition-colors">
                            <td className="py-2 px-3 text-center text-stone-500 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-stone-800">{s.unit}</td>
                            <td className="py-2 px-4 font-black text-emerald-900">Afdeling {s.afdeling}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-stone-700">{s.totalEmployees} Org</td>
                            <td className="py-2 px-3 text-right font-mono text-stone-700">{formatRupiah(s.totalAllowance)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">{formatRupiah(s.totalSpent)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-sky-700">{s.totalCashSpent ? formatRupiah(s.totalCashSpent) : '-'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{formatRupiah(s.totalRemaining)}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-stone-600">{s.utilizationRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#dcfce7] font-black text-emerald-950 border-t-2 border-emerald-500">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 uppercase text-xs">TOTAL KESELURUHAN</td>
                          <td className="py-2.5 px-3 text-center font-mono">{afdelingSummaries.reduce((a, b) => a + b.totalEmployees, 0)} Org</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(afdelingSummaries.reduce((a, b) => a + b.totalAllowance, 0))}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-800">{formatRupiah(afdelingSummaries.reduce((a, b) => a + b.totalSpent, 0))}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-sky-800">{formatRupiah(afdelingSummaries.reduce((a, b) => a + (b.totalCashSpent || 0), 0))}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-900">{formatRupiah(afdelingSummaries.reduce((a, b) => a + b.totalRemaining, 0))}</td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {afdelingSummaries.reduce((a, b) => a + b.totalAllowance, 0) > 0 
                              ? (afdelingSummaries.reduce((a, b) => a + b.totalSpent, 0) / afdelingSummaries.reduce((a, b) => a + b.totalAllowance, 0) * 100).toFixed(1)
                              : 0}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Table of Employees */}
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
                <div className="py-2.5 px-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-800" />
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      Daftar Anggota Karyawan, Sisa Kuota & Pembelian Cash Bulanan
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Plafon Kuota Reset Tiap Tanggal 1
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-[#e6f4ea] text-emerald-950 z-10 font-bold border-b border-emerald-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">No</th>
                        <th className="py-2.5 px-3 text-left w-28">NIK / Kode</th>
                        <th className="py-2.5 px-4 text-left">Nama Karyawan</th>
                        <th className="py-2.5 px-3 text-left w-32">No. WhatsApp</th>
                        <th className="py-2.5 px-3 text-right w-32">Plafon Kuota</th>
                        <th className="py-2.5 px-3 text-right w-32 text-rose-700">Potong Saldo</th>
                        <th className="py-2.5 px-3 text-right w-32 text-sky-700">Beli Cash</th>
                        <th className="py-2.5 px-3 text-right w-36 text-emerald-800">Sisa Saldo</th>
                        <th className="py-2.5 px-4 text-center w-32">% Saldo</th>
                        <th className="py-2.5 px-3 text-center w-24">Status</th>
                        <th className="py-2.5 px-3 text-center w-20">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100 font-medium">
                      {filteredEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-stone-500">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-800" />
                            <p className="font-bold text-sm">Tidak ada data karyawan yang cocok</p>
                            <p className="text-xs opacity-75 mt-0.5">Daftarkan karyawan dengan tipe "KARYAWAN" di Master Data Member</p>
                          </td>
                        </tr>
                      ) : (
                        filteredEmployees.map((emp: EmployeeAllowanceRecord, idx: number) => {
                          const percentUsed = emp.allowance > 0 ? Math.min(Math.round((emp.spent / emp.allowance) * 100), 100) : 0;
                          const cashSpentVal = emp.cash_spent_this_month || 0;
                          return (
                            <tr key={emp.customer_id} className="hover:bg-emerald-50/50 transition-colors">
                              <td className="py-2.5 px-3 text-center text-stone-500 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="font-mono font-bold text-stone-800 px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                                  {emp.code || emp.customer_id}
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="font-bold text-stone-900 text-sm flex items-center space-x-1.5">
                                  <span>{emp.name}</span>
                                </div>
                                <div className="text-[10px] text-stone-500">
                                  {emp.unit || '-'} • Afd {emp.afdeling || '-'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-stone-700 whitespace-nowrap">
                                {emp.phone || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-800 whitespace-nowrap">
                                {formatRupiah(emp.allowance)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                                {formatRupiah(emp.spent)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                                {cashSpentVal > 0 ? (
                                  <div>
                                    <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200 inline-block">
                                      {formatRupiah(cashSpentVal)}
                                    </span>
                                    <div className="text-[9.5px] text-sky-600 font-sans font-semibold mt-0.5">
                                      {emp.cash_trx_count_this_month} nota tunai
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-stone-400">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-300 text-xs inline-block">
                                  {formatRupiah(emp.remaining_balance)}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <div className="flex items-center space-x-2">
                                  <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-2 rounded-full ${
                                        percentUsed >= 100 ? 'bg-rose-600' : percentUsed >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${percentUsed}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-stone-600 w-8 text-right">
                                    {percentUsed}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {emp.status === 'EXHAUSTED' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                    Habis
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Aktif
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleResetSingleFromReport(emp.customer_id, emp.name, emp.allowance)}
                                  className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs transition-colors"
                                  title={`Reset saldo kuota ${emp.name} ke ${formatRupiah(emp.allowance)}`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {filteredEmployees.length > 0 && (
                      <tfoot className="bg-[#e6f4ea] font-black text-emerald-950 border-t-2 border-emerald-500">
                        <tr>
                          <td colSpan={4} className="py-3 px-4 uppercase text-xs">
                            TOTAL ({filteredEmployees.length} Karyawan)
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-stone-900">
                            {formatRupiah(filteredEmployees.reduce((s: number, e: EmployeeAllowanceRecord) => s + e.allowance, 0))}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-rose-800">
                            {formatRupiah(filteredEmployees.reduce((s: number, e: EmployeeAllowanceRecord) => s + e.spent, 0))}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-sky-800">
                            {formatRupiah(filteredEmployees.reduce((s: number, e: EmployeeAllowanceRecord) => s + (e.cash_spent_this_month || 0), 0))}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-900 text-sm">
                            {formatRupiah(filteredEmployees.reduce((s: number, e: EmployeeAllowanceRecord) => s + e.remaining_balance, 0))}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* 4. Status Footer */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-t border-[#e4d5c7] bg-[#f5ece3] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#856b59] flex items-center space-x-2 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>Data tersinkronisasi real-time dengan IndexedDB KetokoPOS</span>
          </div>
        </div>

      </div>
    </div>
  );
};
