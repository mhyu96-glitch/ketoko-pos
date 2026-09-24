import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { db } from '../db';
import type { Product, Transaction, Customer, Supplier } from '../types';

let sqlJsInstance: SqlJsStatic | null = null;

export async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsInstance) return sqlJsInstance;

  try {
    sqlJsInstance = await initSqlJs({
      locateFile: (file) => `/${file}`
    });
    return sqlJsInstance;
  } catch (err) {
    console.warn('[SQLite WASM] Gagal memuat dari /sql-wasm.wasm lokal, mencoba CDN fallback:', err);
    sqlJsInstance = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    });
    return sqlJsInstance;
  }
}

export interface SqlQueryResult {
  columns: string[];
  values: any[][];
  latencyMs: number;
  rowCount: number;
}

export class SQLiteService {
  async exportToSqliteBinary(
    onProgress?: (msg: string) => void
  ): Promise<{ success: boolean; byteSize: number; filename: string; blob: Blob }> {
    onProgress?.('Menginisialisasi SQLite WASM Engine...');
    const SQL = await getSqlJs();
    const sqliteDb = new SQL.Database();

    onProgress?.('Membuat skema tabel SQLite...');
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS store_settings (
        id TEXT PRIMARY KEY,
        name TEXT,
        branch_name TEXT,
        tagline TEXT,
        address TEXT,
        phone TEXT,
        npwp TEXT,
        footer_message TEXT
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        barcode TEXT,
        name TEXT NOT NULL,
        category TEXT,
        buy_price REAL,
        retail_price REAL,
        wholesale_price REAL,
        min_wholesale_qty INTEGER,
        stock INTEGER,
        unit TEXT,
        rack_location TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        credit_limit REAL,
        current_debt REAL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        sales_contact TEXT,
        phone TEXT,
        address TEXT,
        current_debt REAL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        receipt_number TEXT NOT NULL,
        branch_id TEXT,
        cashier_id TEXT,
        cashier_name TEXT,
        customer_id TEXT,
        subtotal REAL,
        discount_amount REAL,
        tax_amount REAL,
        grand_total REAL,
        cash_given REAL,
        change_due REAL,
        payment_method TEXT,
        created_at TEXT,
        synced INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

      CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT,
        product_id TEXT,
        product_name TEXT,
        qty INTEGER,
        cost_price REAL,
        unit_price REAL,
        subtotal REAL
      );

      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY,
        supplier_id TEXT,
        supplier_name TEXT,
        invoice_number TEXT,
        total_amount REAL,
        paid_amount REAL,
        due_date TEXT,
        status TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS receivables (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_name TEXT,
        receipt_number TEXT,
        total_amount REAL,
        paid_amount REAL,
        due_date TEXT,
        status TEXT,
        created_at TEXT
      );
    `);

    // 1. Insert Store Profile
    const savedProfile = localStorage.getItem('ketoko_store_profile');
    if (savedProfile) {
      try {
        const p = JSON.parse(savedProfile);
        sqliteDb.run(
          `INSERT INTO store_settings (id, name, branch_name, tagline, address, phone, npwp, footer_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['default', p.name, p.branch_name, p.tagline, p.address, p.phone, p.npwp, p.footer_message]
        );
      } catch {
        // ignore
      }
    }

    // 2. Insert Products
    onProgress?.('Mengekstrak master 24.500+ produk ke SQLite...');
    const allProducts = await db.products.toArray();
    sqliteDb.run('BEGIN TRANSACTION;');
    const stmtProd = sqliteDb.prepare(`
      INSERT INTO products (id, barcode, name, category, buy_price, retail_price, wholesale_price, min_wholesale_qty, stock, unit, rack_location, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const prod of allProducts) {
      stmtProd.run([
        prod.id,
        prod.barcode || '',
        prod.name,
        prod.category || 'Kebutuhan Umum',
        prod.buy_price || 0,
        prod.retail_price || 0,
        prod.wholesale_price || 0,
        prod.min_wholesale_qty || 1,
        prod.stock || 0,
        prod.unit || 'Pcs',
        prod.rack_location || 'Rak Utama',
        prod.updated_at || new Date().toISOString()
      ]);
    }
    stmtProd.free();
    sqliteDb.run('COMMIT;');

    // 3. Insert Customers & Suppliers
    onProgress?.('Memasukkan data pelanggan & supplier...');
    const customers = await db.customers.toArray();
    for (const c of customers) {
      sqliteDb.run(
        `INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.code, c.name, c.phone || '', c.address || '', c.credit_limit || 0, c.current_debt || 0, c.created_at || '']
      );
    }

    const suppliers = await db.suppliers.toArray();
    for (const s of suppliers) {
      sqliteDb.run(
        `INSERT INTO suppliers VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.code, s.name, s.sales_contact || '', s.phone || '', s.address || '', s.current_debt || 0, s.created_at || '']
      );
    }

    // 4. Insert Transactions & Items
    onProgress?.('Memasukkan riwayat transaksi kasir...');
    const transactions = await db.transactions.toArray();
    sqliteDb.run('BEGIN TRANSACTION;');
    const stmtTrx = sqliteDb.prepare(`
      INSERT INTO transactions (id, receipt_number, branch_id, cashier_id, cashier_name, customer_id, subtotal, discount_amount, tax_amount, grand_total, cash_given, change_due, payment_method, created_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const stmtItem = sqliteDb.prepare(`
      INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, cost_price, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const trx of transactions) {
      stmtTrx.run([
        trx.id,
        trx.receipt_number,
        trx.branch_id || 'BR-01',
        trx.cashier_id || 'KASIR-01',
        trx.cashier_name || 'Kasir',
        trx.member_id || null,
        trx.subtotal,
        trx.discount_amount || 0,
        trx.tax_amount || 0,
        trx.grand_total,
        trx.cash_given || trx.grand_total,
        trx.change_returned || 0,
        trx.payment_method || 'CASH',
        trx.created_at,
        trx.synced ? 1 : 0
      ]);

      if (trx.items) {
        for (const it of trx.items) {
          stmtItem.run([
            trx.id,
            it.product_id,
            it.product_name,
            it.qty,
            it.buy_price || 0,
            it.price_applied,
            it.subtotal_item
          ]);
        }
      }
    }
    stmtTrx.free();
    stmtItem.free();
    sqliteDb.run('COMMIT;');

    // 5. Insert Debts & Receivables
    const debts = await db.debts.toArray();
    for (const d of debts) {
      sqliteDb.run(
        `INSERT INTO debts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.supplier_id, d.supplier_name, d.invoice_number || '', d.total_amount, d.paid_amount || 0, d.due_date || '', d.status || 'UNPAID', d.created_at || '']
      );
    }

    const receivables = await db.receivables.toArray();
    for (const r of receivables) {
      sqliteDb.run(
        `INSERT INTO receivables VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.customer_id, r.customer_name, r.receipt_number || '', r.total_amount, r.paid_amount || 0, r.due_date || '', r.status || 'UNPAID', r.created_at || '']
      );
    }

    // 6. Export Binary
    onProgress?.('Mengompilasi file biner SQLite (.sqlite)...');
    const binaryArray = sqliteDb.export();
    sqliteDb.close();

    const blob = new Blob([binaryArray], { type: 'application/x-sqlite3' });
    const filename = `ketoko_pos_database_${new Date().toISOString().split('T')[0]}_${Date.now()}.sqlite`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    return {
      success: true,
      byteSize: binaryArray.byteLength,
      filename,
      blob
    };
  }

  async importFromSqliteBinary(
    file: File,
    onProgress?: (msg: string) => void
  ): Promise<{ success: boolean; productsCount: number; transactionsCount: number; message: string }> {
    onProgress?.('Membaca file biner SQLite...');
    const buffer = await file.arrayBuffer();
    const u8 = new Uint8Array(buffer);

    const SQL = await getSqlJs();
    const sqliteDb = new SQL.Database(u8);

    onProgress?.('Mengekstrak tabel dan data...');

    let productsCount = 0;
    let transactionsCount = 0;

    try {
      const res = sqliteDb.exec(`SELECT * FROM products`);
      if (res.length > 0 && res[0].values.length > 0) {
        const cols = res[0].columns;
        const productsToPut: Product[] = res[0].values.map((row) => {
          const obj: any = {};
          cols.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj as Product;
        });

        await db.products.clear();
        const chunkSize = 2500;
        for (let i = 0; i < productsToPut.length; i += chunkSize) {
          await db.products.bulkPut(productsToPut.slice(i, i + chunkSize));
        }
        productsCount = productsToPut.length;
      }
    } catch (err: any) {
      console.warn('[SQLite Import] Tabel products dilewati:', err.message);
    }

    try {
      const res = sqliteDb.exec(`SELECT * FROM transactions`);
      if (res.length > 0 && res[0].values.length > 0) {
        const cols = res[0].columns;
        const trxsToPut: Transaction[] = res[0].values.map((row) => {
          const obj: any = {};
          cols.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          obj.synced = Boolean(obj.synced);
          obj.items = [];
          return obj as Transaction;
        });

        try {
          const itemsRes = sqliteDb.exec(`SELECT * FROM transaction_items`);
          if (itemsRes.length > 0 && itemsRes[0].values.length > 0) {
            const itemCols = itemsRes[0].columns;
            for (const itemRow of itemsRes[0].values) {
              const itObj: any = {};
              itemCols.forEach((c, i) => {
                itObj[c] = itemRow[i];
              });
              const parentTrx = trxsToPut.find((t) => t.id === itObj.transaction_id);
              if (parentTrx) {
                parentTrx.items.push({
                  product_id: itObj.product_id,
                  product_name: itObj.product_name,
                  qty: itObj.qty,
                  buy_price: itObj.cost_price,
                  price_applied: itObj.unit_price,
                  is_wholesale: false,
                  subtotal_item: itObj.subtotal
                });
              }
            }
          }
        } catch {
          // ignore
        }

        await db.transactions.bulkPut(trxsToPut);
        transactionsCount = trxsToPut.length;
      }
    } catch (err: any) {
      console.warn('[SQLite Import] Tabel transactions dilewati:', err.message);
    }

    try {
      const res = sqliteDb.exec(`SELECT * FROM customers`);
      if (res.length > 0 && res[0].values.length > 0) {
        const cols = res[0].columns;
        const custs = res[0].values.map((row) => {
          const obj: any = {};
          cols.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj as Customer;
        });
        await db.customers.bulkPut(custs);
      }
    } catch {
      // ignore
    }

    try {
      const res = sqliteDb.exec(`SELECT * FROM suppliers`);
      if (res.length > 0 && res[0].values.length > 0) {
        const cols = res[0].columns;
        const sups = res[0].values.map((row) => {
          const obj: any = {};
          cols.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj as Supplier;
        });
        await db.suppliers.bulkPut(sups);
      }
    } catch {
      // ignore
    }

    sqliteDb.close();

    return {
      success: true,
      productsCount,
      transactionsCount,
      message: `Database berhasil dipulihkan dari file SQLite! (${productsCount} produk, ${transactionsCount} transaksi dimuat).`
    };
  }

  async runSqlQuery(sqlQuery: string): Promise<SqlQueryResult> {
    const startTime = performance.now();
    const SQL = await getSqlJs();
    const sqliteDb = new SQL.Database();

    sqliteDb.run(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        barcode TEXT,
        name TEXT,
        category TEXT,
        buy_price REAL,
        retail_price REAL,
        wholesale_price REAL,
        stock INTEGER,
        unit TEXT,
        rack_location TEXT
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        receipt_number TEXT,
        cashier_name TEXT,
        subtotal REAL,
        grand_total REAL,
        payment_method TEXT,
        created_at TEXT
      );
    `);

    const prods = await db.products.toArray();
    sqliteDb.run('BEGIN TRANSACTION;');
    const stmt = sqliteDb.prepare(`INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const p of prods) {
      stmt.run([
        p.id,
        p.barcode || '',
        p.name,
        p.category || 'Umum',
        p.buy_price || 0,
        p.retail_price || 0,
        p.wholesale_price || 0,
        p.stock || 0,
        p.unit || 'Pcs',
        p.rack_location || 'Rak'
      ]);
    }
    stmt.free();

    const trxs = await db.transactions.toArray();
    const stmtTrx = sqliteDb.prepare(`INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const t of trxs) {
      stmtTrx.run([
        t.id,
        t.receipt_number,
        t.cashier_name || 'Kasir',
        t.subtotal,
        t.grand_total,
        t.payment_method || 'CASH',
        t.created_at
      ]);
    }
    stmtTrx.free();
    sqliteDb.run('COMMIT;');

    const execResult = sqliteDb.exec(sqlQuery);
    const latencyMs = Math.round((performance.now() - startTime) * 10) / 10;
    sqliteDb.close();

    if (execResult.length === 0) {
      return {
        columns: [],
        values: [],
        latencyMs,
        rowCount: 0
      };
    }

    return {
      columns: execResult[0].columns,
      values: execResult[0].values,
      latencyMs,
      rowCount: execResult[0].values.length
    };
  }
}

export const sqliteService = new SQLiteService();
