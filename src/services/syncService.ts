import { db, type PendingSyncItem } from '../db';
import { api } from '../api/client';
import { getSupabaseClient, getSupabaseConfig } from '../api/supabaseClient';
import { INITIAL_PRODUCTS } from '../api/mockData';
import type { Transaction, Product } from '../types';

export interface SyncStatusInfo {
  isConfigured: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

export class SyncService {
  private isSyncing = false;
  private lastSyncTime: string | null = localStorage.getItem('ketoko_last_sync_time');
  private lastError: string | null = null;

  getStatus(): SyncStatusInfo {
    const config = getSupabaseConfig();
    return {
      isConfigured: config.isConfigured,
      isSyncing: this.isSyncing,
      pendingCount: 0,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError
    };
  }

  private notifyStatusChange() {
    this.getPendingCount().then((count) => {
      window.dispatchEvent(new CustomEvent('ketoko_sync_status_updated', {
        detail: {
          isConfigured: getSupabaseConfig().isConfigured,
          isSyncing: this.isSyncing,
          pendingCount: count,
          lastSyncTime: this.lastSyncTime,
          lastError: this.lastError
        }
      }));
    });
  }

  async initCatalog(force = false): Promise<number> {
    const existingCount = await db.products.count();
    const EXPECTED_COUNT = 24531;
    
    if (!force && existingCount >= EXPECTED_COUNT) {
      return existingCount;
    }

    let products: Product[] = [];
    try {
      const res = await fetch('/data/products.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      products = await res.json();
    } catch (err) {
      console.warn('[SyncService] Gagal memuat /data/products.json, menggunakan INITIAL_PRODUCTS fallback:', err);
      products = INITIAL_PRODUCTS;
    }

    if (products.length > 0) {
      await db.products.clear();
      const chunkSize = 2500;
      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        await db.products.bulkPut(chunk);
      }
    }
    
    if ((await db.users.count()) === 0) {
      await db.users.bulkPut([
        {
          id: 'usr-001',
          username: 'suciawati',
          name: 'suciawati Ramadhani',
          role: 'ADMIN',
          branch_id: 'BR-01'
        },
        {
          id: 'usr-002',
          username: 'noor',
          name: 'Noor Afifah',
          role: 'CASHIER',
          branch_id: 'BR-01'
        },
        {
          id: 'usr-003',
          username: 'admin',
          name: 'suciawati Ramadhani',
          role: 'ADMIN',
          branch_id: 'BR-01'
        },
        {
          id: 'usr-004',
          username: 'kasir',
          name: 'Noor Afifah',
          role: 'CASHIER',
          branch_id: 'BR-01'
        }
      ]);
    }
    
    return await db.products.count();
  }

  async saveTransactionOffline(transaction: Transaction): Promise<void> {
    await db.transaction('rw', db.transactions, db.products, db.syncQueue, async () => {
      await db.transactions.put(transaction);

      for (const item of transaction.items) {
        const prod = await db.products.get(item.product_id);
        if (prod) {
          await db.products.update(item.product_id, {
            stock: Math.max(0, prod.stock - item.qty)
          });
        }
      }

      const queueItem: PendingSyncItem = {
        id: transaction.id,
        payload: transaction,
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString()
      };
      await db.syncQueue.put(queueItem);
    });

    this.notifyStatusChange();

    if (navigator.onLine) {
      this.reconcileQueue().catch(() => {});
    }
  }

  async reconcileQueue(branchId = 'BR-01'): Promise<{ syncedCount: number; failedCount: number }> {
    if (this.isSyncing) return { syncedCount: 0, failedCount: 0 };

    this.isSyncing = true;
    this.lastError = null;
    this.notifyStatusChange();

    try {
      const pendingItems = await db.syncQueue
        .where('status')
        .equals('pending')
        .or('status')
        .equals('failed')
        .toArray();

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notifyStatusChange();
        return { syncedCount: 0, failedCount: 0 };
      }

      const transactionsToSync = pendingItems.map((item) => item.payload);

      for (const item of pendingItems) {
        await db.syncQueue.update(item.id, {
          status: 'syncing',
          last_attempt: new Date().toISOString()
        });
      }

      const supabase = getSupabaseClient();
      let syncedIds: string[] = [];
      let failedIds: string[] = [];

      if (supabase) {
        for (const trx of transactionsToSync) {
          try {
            const { error: headerErr } = await supabase.from('transactions').upsert({
              id: trx.id,
              receipt_number: trx.receipt_number,
              branch_id: trx.branch_id || branchId,
              cashier_id: trx.cashier_id || 'KASIR-01',
              cashier_name: trx.cashier_name || 'Kasir Toko',
              customer_id: trx.member_id || null,
              subtotal: trx.subtotal,
              discount_amount: trx.discount_amount || 0,
              tax_amount: trx.tax_amount || 0,
              grand_total: trx.grand_total,
              cash_given: trx.cash_given || trx.grand_total,
              change_due: trx.change_returned || 0,
              payment_method: trx.payment_method || 'CASH',
              created_at: trx.created_at,
              synced_at: new Date().toISOString()
            });

            if (headerErr) throw headerErr;

            if (trx.items && trx.items.length > 0) {
              const itemsPayload = trx.items.map((it) => ({
                transaction_id: trx.id,
                product_id: it.product_id,
                product_name: it.product_name,
                qty: it.qty,
                cost_price: it.buy_price || 0,
                unit_price: it.price_applied,
                subtotal: it.subtotal_item,
                created_at: trx.created_at
              }));

              const { error: itemsErr } = await supabase.from('transaction_items').insert(itemsPayload);
              if (itemsErr) throw itemsErr;
            }

            syncedIds.push(trx.id);
          } catch (err: any) {
            console.error(`[SupabaseSync] Gagal upload transaksi ${trx.receipt_number}:`, err);
            failedIds.push(trx.id);
          }
        }

        try {
          await supabase.from('sync_logs').insert({
            branch_id: branchId,
            operation_type: 'PUSH_TRANSACTIONS',
            synced_records_count: syncedIds.length,
            status: failedIds.length === 0 ? 'SUCCESS' : 'PARTIAL',
            error_message: failedIds.length > 0 ? `Failed IDs: ${failedIds.join(', ')}` : null
          });
        } catch {
          // ignore
        }

      } else {
        const response = await api.syncBatchTransactions({
          branch_id: branchId,
          transactions: transactionsToSync
        });
        syncedIds = response.synced_ids || [];
        failedIds = response.failed_ids || [];
      }

      for (const trxId of syncedIds) {
        await db.transactions.update(trxId, {
          synced: true,
          synced_at: new Date().toISOString()
        });
        await db.syncQueue.delete(trxId);
      }

      for (const trxId of failedIds) {
        const item = await db.syncQueue.get(trxId);
        if (item) {
          await db.syncQueue.update(trxId, {
            status: 'failed',
            attempts: (item.attempts || 0) + 1,
            error: 'Server gagal memproses transaksi'
          });
        }
      }

      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('ketoko_last_sync_time', this.lastSyncTime);

      return { syncedCount: syncedIds.length, failedCount: failedIds.length };
    } catch (err: any) {
      console.warn('[SyncService] Sinkronisasi tertunda (Offline/Error):', err.message);
      this.lastError = err.message;
      
      const syncingItems = await db.syncQueue.where('status').equals('syncing').toArray();
      for (const item of syncingItems) {
        await db.syncQueue.update(item.id, {
          status: 'pending',
          attempts: (item.attempts || 0) + 1,
          error: err.message
        });
      }
      return { syncedCount: 0, failedCount: 0 };
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  async pullFromSupabase(): Promise<{ count: number; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { count: 0, error: 'Supabase belum dikonfigurasi.' };
    }

    try {
      this.isSyncing = true;
      this.notifyStatusChange();

      const { data: cloudProducts, error } = await supabase
        .from('products')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (cloudProducts && cloudProducts.length > 0) {
        await db.products.bulkPut(cloudProducts as Product[]);
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem('ketoko_last_sync_time', this.lastSyncTime);
        return { count: cloudProducts.length };
      }

      return { count: 0 };
    } catch (err: any) {
      this.lastError = err.message;
      return { count: 0, error: err.message };
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  async pushCatalogToSupabase(
    onProgress?: (progress: { current: number; total: number; percent: number }) => void
  ): Promise<{ success: boolean; totalUploaded: number; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, totalUploaded: 0, error: 'Supabase belum dikonfigurasi.' };
    }

    try {
      const allProducts = await db.products.toArray();
      const total = allProducts.length;
      const chunkSize = 500;
      let current = 0;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = allProducts.slice(i, i + chunkSize);
        const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
        if (error) throw error;

        current += chunk.length;
        onProgress?.({
          current,
          total,
          percent: Math.round((current / total) * 100)
        });
      }

      return { success: true, totalUploaded: total };
    } catch (err: any) {
      return { success: false, totalUploaded: 0, error: err.message };
    }
  }

  async getPendingCount(): Promise<number> {
    return await db.syncQueue.count();
  }

  async getRecentTransactions(limit = 20): Promise<Transaction[]> {
    return await db.transactions.orderBy('created_at').reverse().limit(limit).toArray();
  }
}

export const syncService = new SyncService();
