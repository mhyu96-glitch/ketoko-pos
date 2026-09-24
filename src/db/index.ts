import Dexie, { type Table } from 'dexie';
import type { 
  Product, 
  Transaction, 
  Customer, 
  Supplier, 
  DebtItem, 
  ReceivableItem, 
  PurchaseRecord, 
  PurchaseReturn, 
  SalesReturn, 
  StockMovement,
  User 
} from '../types';

export interface PendingSyncItem {
  id: string; // transaction id
  payload: Transaction;
  status: 'pending' | 'syncing' | 'failed';
  attempts: number;
  created_at: string;
  last_attempt?: string;
  error?: string;
}

export class KetokoDatabase extends Dexie {
  products!: Table<Product, string>;
  transactions!: Table<Transaction, string>;
  syncQueue!: Table<PendingSyncItem, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  debts!: Table<DebtItem, string>;
  receivables!: Table<ReceivableItem, string>;
  purchases!: Table<PurchaseRecord, string>;
  purchaseReturns!: Table<PurchaseReturn, string>;
  salesReturns!: Table<SalesReturn, string>;
  stockMovements!: Table<StockMovement, string>;
  users!: Table<User, string>;
  usersLocal!: Table<User, string>;

  constructor() {
    super('KetokoPOS_DB');
    this.version(2).stores({
      products: 'id, barcode, category, name, updated_at',
      transactions: 'id, receipt_number, cashier_id, created_at, synced',
      syncQueue: 'id, status, created_at, attempts',
      customers: 'id, code, name, phone, created_at',
      suppliers: 'id, code, name, phone, created_at',
      debts: 'id, supplier_id, due_date, status, created_at',
      receivables: 'id, customer_id, due_date, status, created_at',
      purchases: 'id, invoice_number, supplier_id, date, created_at',
      purchaseReturns: 'id, return_number, supplier_id, date, created_at',
      salesReturns: 'id, return_number, receipt_number, date, created_at',
      stockMovements: 'id, product_id, type, date, created_at',
      users: 'id, username, role, branch_id',
      usersLocal: 'id, username, role, branch_id'
    });
  }
}

export const db = new KetokoDatabase();
