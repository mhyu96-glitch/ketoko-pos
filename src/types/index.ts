export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  buy_price: number;
  retail_price: number;
  wholesale_price: number;
  min_wholesale_qty: number;
  stock: number;
  unit: string;
  rack_location: string;
  min_stock_alert: number;
  image_url?: string;
  badge_type?: string;
  discount_percent?: number;
  weight_label?: string;
  rating?: number;
  updated_at?: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  barcode: string;
  buy_price: number;
  retail_price: number;
  wholesale_price: number;
  min_wholesale_qty: number;
  stock: number;
  unit: string;
  qty: number;
  price_applied: number;
  is_wholesale: boolean;
  subtotal_item: number;
}

export interface TransactionItem {
  product_id: string;
  product_name: string;
  qty: number;
  buy_price?: number;
  price_applied: number;
  is_wholesale: boolean;
  subtotal_item: number;
}

export interface Transaction {
  id: string;
  receipt_number: string;
  cashier_id: string;
  cashier_name?: string;
  branch_id?: string;
  member_id?: string;
  items: TransactionItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  payment_method: 'CASH' | 'QRIS' | 'DEBIT' | 'TRANSFER';
  cash_given: number;
  change_returned: number;
  created_at: string;
  synced: boolean;
  synced_at?: string;
}

export interface User {
  id: string;
  username?: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'CASHIER' | 'MANAGER';
  branch_id: string;
  token?: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  message?: string;
  data?: {
    user: User;
    token: string;
  };
}

export interface SyncResponse {
  status: 'success' | 'partial' | 'error';
  synced_count?: number;
  synced_ids?: string[];
  failed_ids?: string[];
  timestamp?: string;
  conflicts?: Array<{
    transaction_id: string;
    reason: string;
  }>;
}

export type SyncBatchResponse = SyncResponse;

export interface SyncBatchPayload {
  branch_id?: string;
  transactions: Transaction[];
}

export interface CatalogResponse {
  status: 'success' | 'error';
  timestamp: string;
  data: Product[];
}

export type ProductSyncResponse = CatalogResponse;

export interface OperationalExpense {
  id: string;
  category: 'OPERASIONAL' | 'GAJI' | 'LISTRIK_AIR' | 'SEWA' | 'PERLENGKAPAN' | 'LAINNYA';
  title: string;
  amount: number;
  date: string;
  notes?: string;
}

// 1. Pelanggan & Supplier
export interface Customer {
  id: string;
  code: string; // e.g. "PLG-001"
  name: string;
  phone: string;
  address: string;
  credit_limit?: number;
  current_receivable?: number;
  current_debt?: number;
  notes?: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  code: string; // e.g. "SUP-001"
  name: string;
  sales_contact: string;
  phone: string;
  address: string;
  payment_term_days?: number; // e.g. 14 or 30 days
  current_debt?: number;
  notes?: string;
  created_at?: string;
}

// 2. Hutang & Piutang
export interface DebtItem {
  id: string;
  supplier_id: string;
  supplier_code?: string;
  supplier_name: string;
  invoice_number: string;
  invoice_date?: string;
  transaction_date?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string; // YYYY-MM-DD
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  created_at?: string;
  notes?: string;
}

export type DebtRecord = DebtItem;

export interface ReceivableItem {
  id: string;
  customer_id: string;
  customer_code?: string;
  customer_name: string;
  receipt_number: string;
  transaction_id?: string;
  invoice_date?: string;
  transaction_date?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string; // YYYY-MM-DD
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  created_at?: string;
  notes?: string;
}

export type ReceivableRecord = ReceivableItem;

// 3. Pembelian & Retur
export interface PurchaseItem {
  product_id: string;
  product_name: string;
  barcode?: string;
  buy_price: number;
  qty: number;
  subtotal: number;
}

export interface PurchaseRecord {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  date: string; // YYYY-MM-DD
  payment_type: 'CASH' | 'TEMPO';
  due_date?: string;
  items: PurchaseItem[];
  subtotal?: number;
  discount?: number;
  total: number;
  status?: string;
  cashier_name?: string;
  notes?: string;
  created_at?: string;
}

export type Purchase = PurchaseRecord;

export interface PurchaseReturn {
  id: string;
  return_number: string;
  invoice_number?: string;
  purchase_invoice?: string;
  supplier_id: string;
  supplier_name: string;
  date: string;
  items: {
    product_id: string;
    product_name: string;
    qty: number;
    buy_price?: number;
    price?: number;
    subtotal: number;
    reason: string;
  }[];
  total_return: number;
  action: 'POTONG_HUTANG' | 'KEMBALI_TUNAI';
  created_at?: string;
}

export interface SalesReturn {
  id: string;
  return_number: string;
  receipt_number: string;
  customer_name: string;
  date: string;
  items: {
    product_id: string;
    product_name: string;
    qty: number;
    price?: number;
    buy_price?: number;
    subtotal: number;
    reason: string;
  }[];
  total_refund: number;
  refund_method: 'CASH' | 'POTONG_PIUTANG';
  created_at?: string;
}

// 4. Mutasi Item Masuk / Keluar & Stok Opname
export interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'OPNAME';
  product_id: string;
  product_name: string;
  barcode: string;
  qty: number;
  previous_stock?: number;
  current_stock: number;
  reason_category: 'BONUS_SALES' | 'SAMPLE' | 'HADIAH_ORANG' | 'RUSAK' | 'EXPIRED' | 'OPNAME_ADJUSTMENT' | 'LAINNYA';
  notes?: string;
  date: string;
  created_by?: string;
  created_at?: string;
}

// 5. Store Profile
export interface StoreProfile {
  name: string;
  pos_title?: string;
  branch_name?: string;
  tagline: string;
  address: string;
  city?: string;
  phone: string;
  npwp?: string;
  footer_message: string;
  logo_base64?: string;
}

