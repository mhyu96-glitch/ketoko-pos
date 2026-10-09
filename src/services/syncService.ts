import { db, type PendingSyncItem } from '../db';
import { api } from '../api/client';
import { getSupabaseClient, getSupabaseConfig } from '../api/supabaseClient';
import { INITIAL_PRODUCTS } from '../api/mockData';
import type { Transaction, Product } from '../types';
import { lanService } from './lanService';

export interface SyncStatusInfo {
  isConfigured: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

export interface CloudRealtimeCallbacks {
  onProductUpdated?: (product: Product) => void;
  onProductDeleted?: (productId: string) => void;
  onCatalogRefreshed?: (info: any) => void;
  onStockUpdated?: (updatedStocks: Array<{ id: string; stock: number }>) => void;
  onTransactionCreated?: (data: any) => void;
  onTransactionDeleted?: (data: any) => void;
  onPurchaseCreated?: (purchase: any) => void;
  onDebtReceivableUpdated?: () => void;
  onReceivableCreated?: (receivable: any) => void;
}

export class SyncService {
  private isSyncing = false;
  private lastSyncTime: string | null = localStorage.getItem('ketoko_last_sync_time');
  private lastError: string | null = null;
  private cloudLiveChannel: any = null;
  private channelReadyPromise: Promise<void> | null = null;
  private realtimeCallbacks: CloudRealtimeCallbacks = {};

  public initCloudLiveChannel(callbacks?: CloudRealtimeCallbacks) {
    if (callbacks) {
      this.realtimeCallbacks = { ...this.realtimeCallbacks, ...callbacks };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    if (this.cloudLiveChannel) {
      return this.cloudLiveChannel;
    }

    let resolveReady: () => void;
    this.channelReadyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });

    const ch = supabase.channel('ketoko_global_live_sync', {
      config: { broadcast: { self: false } }
    });

    ch.on('broadcast', { event: 'product_updated' }, ({ payload }) => {
      const prod = payload as Product;
      if (prod && prod.id) {
        if (this.getDeletedProductIds().has(String(prod.id))) return;
        db.products.put(prod).catch(() => {});
        this.realtimeCallbacks.onProductUpdated?.(prod);
      }
    })
    .on('broadcast', { event: 'product_deleted' }, async ({ payload }) => {
      const prodId = String(payload?.id || payload?.product_id || '').trim();
      if (prodId) {
        this.markProductDeletedLocally(prodId);
        await db.products.delete(prodId).catch(() => {});
        this.realtimeCallbacks.onProductDeleted?.(prodId);
      }
    })
    .on('broadcast', { event: 'catalog_refreshed' }, async ({ payload }) => {
      console.log('[SyncService] Katalog diperbarui di Cloud oleh komputer lain:', payload);
      await this.pullFromSupabase().catch(() => {});
      this.realtimeCallbacks.onCatalogRefreshed?.(payload);
    })
    .on('broadcast', { event: 'purchase_created' }, async ({ payload }) => {
      if (payload && payload.id) {
        await db.purchases.put(payload).catch(() => {});
        this.realtimeCallbacks.onPurchaseCreated?.(payload);
      }
    })
    .on('broadcast', { event: 'transaction_created' }, async ({ payload }) => {
      const trx = payload?.transaction || (payload?.items ? payload : null);
      if (trx && trx.id) {
        await db.transactions.put(trx).catch(() => {});
      }
      if (payload?.updated_stocks && Array.isArray(payload.updated_stocks)) {
        for (const s of payload.updated_stocks) {
          db.products.update(String(s.id), { stock: Number(s.stock) || 0 }).catch(() => {});
        }
      }
      this.realtimeCallbacks.onTransactionCreated?.(payload);
    })
    .on('broadcast', { event: 'transaction_deleted' }, async ({ payload }) => {
      const trxId = payload?.transaction_id || payload?.id;
      if (trxId) {
        this.markTransactionDeletedLocally(trxId);
        await db.transactions.delete(trxId).catch(() => {});
        await db.syncQueue.delete(trxId).catch(() => {});
      }
      if (payload?.updated_stocks && Array.isArray(payload.updated_stocks)) {
        for (const s of payload.updated_stocks) {
          db.products.update(String(s.id), { stock: Number(s.stock) || 0 }).catch(() => {});
        }
      }
      this.realtimeCallbacks.onTransactionDeleted?.(payload);
    })
    .on('broadcast', { event: 'stock_updated' }, ({ payload }) => {
      if (Array.isArray(payload)) {
        for (const s of payload) {
          db.products.update(String(s.id), { stock: Number(s.stock) || 0 }).catch(() => {});
        }
        this.realtimeCallbacks.onStockUpdated?.(payload);
      }
    })
    .on('broadcast', { event: 'debt_receivable_updated' }, async () => {
      await this.syncDebtsAndReceivables().catch(() => {});
      this.realtimeCallbacks.onDebtReceivableUpdated?.();
    })
    .on('broadcast', { event: 'receivable_created' }, async ({ payload }) => {
      if (payload && payload.id) {
        await db.receivables.put(payload).catch(() => {});
        this.realtimeCallbacks.onReceivableCreated?.(payload);
      }
    });

    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('[SyncService] Supabase Realtime Channel terhubung (SUBSCRIBED)');
        resolveReady();
      }
    });

    this.cloudLiveChannel = ch;
    return ch;
  }

  public resetCloudLiveChannel() {
    if (this.cloudLiveChannel) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          supabase.removeChannel(this.cloudLiveChannel);
        }
      } catch {}
      this.cloudLiveChannel = null;
      this.channelReadyPromise = null;
    }
  }

  public getCloudLiveChannel() {
    return this.initCloudLiveChannel();
  }

  public async broadcastCloudEvent(event: string, payload: any): Promise<boolean> {
    try {
      const ch = this.initCloudLiveChannel();
      if (!ch) return false;

      if (this.channelReadyPromise) {
        await Promise.race([
          this.channelReadyPromise,
          new Promise((r) => setTimeout(r, 1500))
        ]);
      }

      const res = await ch.send({
        type: 'broadcast',
        event,
        payload
      });
      return res === 'ok';
    } catch (err) {
      console.warn('[Sync] Broadcast cloud event error:', err);
      return false;
    }
  }

  /**
   * Pastikan customer tersimpan di Supabase sebelum digunakan sebagai foreign key
   */
  async ensureCustomerExists(supabase: any, customerId: string, customerName?: string): Promise<string | null> {
    if (!customerId) return null;
    const cleanId = String(customerId).trim();
    if (!cleanId) return null;
    try {
      const { data, error } = await supabase.from('customers').upsert({
        id: cleanId,
        name: customerName || `Pelanggan ${cleanId}`,
        type: 'RETAIL'
      }, { onConflict: 'id' }).select('id').single();
      if (!error && data?.id) return String(data.id);
      if (!error) return cleanId;
    } catch {}
    return null;
  }

  /**
   * Pastikan supplier tersimpan di Supabase sebelum digunakan sebagai foreign key
   */
  async ensureSupplierExists(supabase: any, supplierId: string, supplierName?: string): Promise<string | null> {
    if (!supplierId) return null;
    const cleanId = String(supplierId).trim();
    if (!cleanId) return null;
    try {
      const { data, error } = await supabase.from('suppliers').upsert({
        id: cleanId,
        name: supplierName || `Supplier ${cleanId}`
      }, { onConflict: 'id' }).select('id').single();
      if (!error && data?.id) return String(data.id);
      if (!error) return cleanId;
    } catch {}
    return null;
  }

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
    const updatedStocks: Array<{ id: string; stock: number }> = [];

    await db.transaction('rw', db.transactions, db.products, db.syncQueue, async () => {
      await db.transactions.put(transaction);

      for (const item of transaction.items) {
        const prod = await db.products.get(item.product_id);
        if (prod) {
          const newStock = Math.max(0, prod.stock - item.qty);
          await db.products.update(item.product_id, {
            stock: newStock
          });
          updatedStocks.push({ id: item.product_id, stock: newStock });
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

    // 1. Update stok di tabel products Supabase Cloud secara langsung jika online
    if (navigator.onLine && updatedStocks.length > 0) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          for (const s of updatedStocks) {
            Promise.resolve(
              supabase
                .from('products')
                .update({ stock: s.stock, updated_at: new Date().toISOString() })
                .eq('id', s.id)
            ).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[Sync] Gagal update stok produk di Supabase:', err);
      }
    }

    // 2. Siarkan ke tab/jendela lain di mesin yang sama via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ketoko_product_sync');
        bc.postMessage({
          type: 'transaction_created',
          transaction,
          updated_stocks: updatedStocks
        });
        bc.close();
      }
    } catch {}

    // 3. Dispatch DOM event untuk komponen lokal di window yang sama
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ketoko_transaction_created', {
          detail: { transaction, updated_stocks: updatedStocks }
        })
      );
    }

    // 4. Siarkan broadcast ke komputer kasir/admin di cloud (antar jaringan berbeda)
    this.broadcastCloudEvent('transaction_created', {
      transaction,
      ...transaction,
      updated_stocks: updatedStocks
    });
    if (updatedStocks.length > 0) {
      this.broadcastCloudEvent('stock_updated', updatedStocks);
    }

    this.notifyStatusChange();

    if (navigator.onLine) {
      this.reconcileQueue().catch(() => {});
    }
  }

  /**
   * Mengambil daftar ID transaksi yang telah dihapus agar tidak pernah ter-reupload kembali (Tombstone)
   */
  getDeletedTransactionIds(): Set<string> {
    try {
      const saved = localStorage.getItem('ketoko_deleted_trx_ids');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      }
    } catch {}
    return new Set();
  }

  markTransactionDeletedLocally(trxId: string) {
    try {
      const set = this.getDeletedTransactionIds();
      set.add(trxId);
      const arr = Array.from(set).slice(-500);
      localStorage.setItem('ketoko_deleted_trx_ids', JSON.stringify(arr));
    } catch {}
  }

  /**
   * Mengambil daftar ID produk yang telah dihapus agar tidak pernah ditarik ulang oleh sync (Tombstone)
   */
  getDeletedProductIds(): Set<string> {
    try {
      const saved = localStorage.getItem('ketoko_deleted_product_ids');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          return new Set(arr.map(String));
        }
      }
    } catch {}
    return new Set();
  }

  markProductDeletedLocally(productId: string) {
    try {
      const cleanId = String(productId).trim();
      if (!cleanId) return;
      const set = this.getDeletedProductIds();
      set.add(cleanId);
      const arr = Array.from(set).slice(-1000);
      localStorage.setItem('ketoko_deleted_product_ids', JSON.stringify(arr));
    } catch {}
  }

  /**
   * Menghapus produk/item secara real-time ke seluruh terminal (Lokal, Tab lain, LAN, dan Cloud Supabase)
   */
  async deleteProduct(productId: string): Promise<boolean> {
    const cleanId = String(productId).trim();
    if (!cleanId) return false;

    // 1. Catat ke daftar tombstone lokal SEGERA agar tidak pernah ditarik ulang oleh auto-sync
    this.markProductDeletedLocally(cleanId);

    // 2. HAPUS DARI INDEXEDDB LOKAL SEKETIKA (0ms delay)
    await db.products.delete(cleanId).catch(() => {});

    // 3. DISPATCH DOM EVENT LOKAL SEKETIKA agar Dashboard, POS & List langsung berkurang tanpa delay
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ketoko_product_deleted', { detail: { id: cleanId } }));
    }

    // 4. Siarkan ke tab/jendela lain di mesin yang sama via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ketoko_product_sync');
        bc.postMessage({ type: 'product_deleted', product_id: cleanId });
        bc.close();
      }
    } catch {}

    // 5. Kirim perintah hapus ke LAN Server (jika aktif)
    lanService.deleteProduct(cleanId).catch(() => {});

    // 6. Hapus dari Cloud Supabase & Catat Tombstone di sync_logs
    if (navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await Promise.allSettled([
            supabase.from('products').delete().eq('id', cleanId),
            supabase.from('sync_logs').insert({
              branch_id: 'BR-01',
              operation_type: 'DELETE_PRODUCT',
              error_message: cleanId,
              status: 'DELETED',
              synced_at: new Date().toISOString()
            })
          ]);
        }
      } catch (err) {
        console.warn('[Sync] Gagal hapus produk dari Supabase:', err);
      }
    }

    // 7. Siarkan realtime broadcast ke semua terminal kasir & admin di cloud (berbeda komputer)
    await this.broadcastCloudEvent('product_deleted', { id: cleanId, product_id: cleanId });

    this.notifyStatusChange();
    return true;
  }

  /**
   * Menghapus banyak produk sekaligus (Batch Delete) secara efisien & realtime ke Cloud & Lokal
   */
  async deleteProductsBatch(productIds: string[]): Promise<{ success: boolean; deletedCount: number }> {
    if (!productIds || productIds.length === 0) return { success: true, deletedCount: 0 };

    const cleanIds = Array.from(new Set(productIds.map(id => String(id).trim()).filter(Boolean)));
    if (cleanIds.length === 0) return { success: true, deletedCount: 0 };

    // 1. Catat ke daftar tombstone lokal
    cleanIds.forEach(id => this.markProductDeletedLocally(id));

    // 2. Hapus dari IndexedDB lokal
    await db.products.bulkDelete(cleanIds).catch(() => {});

    // 3. Dispatch DOM event lokal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ketoko_product_deleted', { detail: { ids: cleanIds } }));
    }

    // 4. Siarkan via BroadcastChannel lokal
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ketoko_product_sync');
        bc.postMessage({ type: 'catalog_refreshed', ids: cleanIds });
        bc.close();
      }
    } catch {}

    // 5. LAN service
    try {
      for (const id of cleanIds) {
        lanService.deleteProduct(id).catch(() => {});
      }
    } catch {}

    // 6. Hapus dari Cloud Supabase & Catat Tombstone di sync_logs
    if (navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const batchSize = 100;
          for (let i = 0; i < cleanIds.length; i += batchSize) {
            const batch = cleanIds.slice(i, i + batchSize);
            await supabase.from('products').delete().in('id', batch);

            const logsToInsert = batch.map((bId) => ({
              branch_id: 'BR-01',
              operation_type: 'DELETE_PRODUCT',
              error_message: bId,
              status: 'DELETED',
              synced_at: new Date().toISOString()
            }));
            await supabase.from('sync_logs').insert(logsToInsert);
          }
        }
      } catch (err) {
        console.warn('[Sync] Gagal batch delete produk dari Supabase:', err);
      }
    }

    // 7. Siarkan realtime broadcast ke seluruh terminal kasir & admin di Cloud
    await this.broadcastCloudEvent('catalog_refreshed', {
      timestamp: new Date().toISOString(),
      deletedCount: cleanIds.length
    });

    this.notifyStatusChange();
    return { success: true, deletedCount: cleanIds.length };
  }

  /**
   * Dorong seluruh transaksi lokal yang belum ada di Supabase Cloud (sinkronisasi 2 arah otomatis)
   */
  async pushLocalTransactionsToSupabase(): Promise<{ pushedCount: number }> {
    const supabase = getSupabaseClient();
    if (!supabase || !navigator.onLine) return { pushedCount: 0 };

    try {
      // 1. Ambil daftar transaksi yang sudah dihapus dari tombstone lokal & Cloud
      const deletedIds = this.getDeletedTransactionIds();

      // Tarik tombstone dari Supabase sync_logs agar HP/Laptop sinkron mengetahui nota yang dihapus
      try {
        const { data: remoteDeleted } = await supabase
          .from('sync_logs')
          .select('error_message')
          .eq('operation_type', 'DELETE_TRANSACTION')
          .order('synced_at', { ascending: false })
          .limit(100);

        if (remoteDeleted && remoteDeleted.length > 0) {
          for (const item of remoteDeleted) {
            if (item.error_message) {
              deletedIds.add(item.error_message);
              this.markTransactionDeletedLocally(item.error_message);
            }
          }
        }
      } catch {}

      // Bersihkan transaksi lokal yang sudah tercatat dihapus (cegah zombie re-upload)
      for (const delId of deletedIds) {
        await db.transactions.delete(delId).catch(() => {});
        await db.syncQueue.delete(delId).catch(() => {});
      }

      const allLocal = await db.transactions.toArray();
      if (!allLocal || allLocal.length === 0) return { pushedCount: 0 };

      // Hanya proses transaksi aktif yang TIDAK ada di daftar terhapus
      const validLocal = allLocal.filter((t) => !deletedIds.has(String(t.id)));
      if (validLocal.length === 0) return { pushedCount: 0 };

      // Cek ID transaksi yang sudah ada di Supabase Cloud
      const { data: cloudIdsData } = await supabase.from('transactions').select('id');
      const cloudIdSet = new Set((cloudIdsData || []).map((t: any) => String(t.id)));

      // Ambil transaksi yang belum ada di Cloud atau ditandai belum synced
      const toPush = validLocal.filter((t) => !cloudIdSet.has(String(t.id)) || !t.synced);
      if (toPush.length === 0) return { pushedCount: 0 };

      let pushed = 0;
      for (const trx of toPush) {
        try {
          let validCustomerId: string | null = null;
          if (trx.member_id) {
            validCustomerId = await this.ensureCustomerExists(supabase, trx.member_id, trx.customer_name);
          }

          const trxPayload: any = {
            id: String(trx.id),
            receipt_number: trx.receipt_number,
            branch_id: trx.branch_id || 'BR-01',
            cashier_id: trx.cashier_id || 'KASIR-01',
            cashier_name: trx.cashier_name || 'Kasir Toko',
            customer_id: validCustomerId,
            customer_name: trx.customer_name || (validCustomerId ? `Member #${validCustomerId}` : null),
            subtotal: Number(trx.subtotal) || 0,
            discount_amount: Number(trx.discount_amount) || 0,
            tax_amount: Number(trx.tax_amount) || 0,
            grand_total: Number(trx.grand_total) || 0,
            cash_given: Number(trx.cash_given) || Number(trx.grand_total) || 0,
            change_due: Number(trx.change_returned) || 0,
            payment_method: trx.payment_method || 'CASH',
            payment_status: trx.payment_method === 'TEMPO' ? (Number(trx.cash_given) >= Number(trx.grand_total) ? 'PAID' : 'PENDING') : 'PAID',
            notes: trx.notes || (trx.due_date ? `Jatuh Tempo: ${trx.due_date}` : null),
            created_at: trx.created_at || new Date().toISOString(),
            synced_at: new Date().toISOString()
          };

          let { error: headerErr } = await supabase.from('transactions').upsert(trxPayload, { onConflict: 'id' });
          if (headerErr && (headerErr.code === '23503' || headerErr.message?.includes('violates foreign key constraint'))) {
            trxPayload.customer_id = null;
            const retry = await supabase.from('transactions').upsert(trxPayload, { onConflict: 'id' });
            headerErr = retry.error;
          }

          if (!headerErr) {
            if (trx.items && trx.items.length > 0) {
              await supabase.from('transaction_items').delete().eq('transaction_id', trx.id);
              const itemsPayload = trx.items.map((it) => ({
                transaction_id: trx.id,
                product_id: String(it.product_id),
                product_name: it.product_name,
                qty: Number(it.qty) || 1,
                unit: it.unit || 'Pcs',
                cost_price: Number(it.buy_price) || 0,
                unit_price: Number(it.price_applied) || 0,
                subtotal: Number(it.subtotal_item) || 0,
                created_at: trx.created_at || new Date().toISOString()
              }));
              await supabase.from('transaction_items').insert(itemsPayload);
            }

            await db.transactions.update(trx.id, {
              synced: true,
              synced_at: new Date().toISOString()
            });
            await db.syncQueue.delete(trx.id).catch(() => {});
            pushed++;
          }
        } catch (err) {
          console.warn('[SyncService] Gagal push transaksi ke Supabase:', trx.id, err);
        }
      }

      if (pushed > 0) {
        this.broadcastCloudEvent('transaction_created', { count: pushed, timestamp: new Date().toISOString() });
      }

      return { pushedCount: pushed };
    } catch (err: any) {
      console.warn('[SyncService] Gagal sinkronisasi transaksi lokal ke Cloud:', err.message);
      return { pushedCount: 0 };
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
        .or('status')
        .equals('syncing')
        .toArray();

      // Kumpulkan juga transaksi di db.transactions yang belum synced
      const unsyncedTransactions = await db.transactions
        .filter((t) => !t.synced)
        .toArray();

      const queueIds = new Set(pendingItems.map((p) => p.id));
      for (const trx of unsyncedTransactions) {
        if (!queueIds.has(trx.id)) {
          pendingItems.push({
            id: trx.id,
            payload: trx,
            status: 'pending',
            attempts: 0,
            created_at: trx.created_at || new Date().toISOString()
          });
        }
      }

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
            let validCustomerId: string | null = null;
            if (trx.member_id) {
              validCustomerId = await this.ensureCustomerExists(supabase, trx.member_id, trx.customer_name);
            }

            const trxPayload: any = {
              id: String(trx.id),
              receipt_number: trx.receipt_number,
              branch_id: trx.branch_id || branchId,
              cashier_id: trx.cashier_id || 'KASIR-01',
              cashier_name: trx.cashier_name || 'Kasir Toko',
              customer_id: validCustomerId,
              customer_name: trx.customer_name || (validCustomerId ? `Member #${validCustomerId}` : null),
              subtotal: Number(trx.subtotal) || 0,
              discount_amount: Number(trx.discount_amount) || 0,
              tax_amount: Number(trx.tax_amount) || 0,
              grand_total: Number(trx.grand_total) || 0,
              cash_given: Number(trx.cash_given) || Number(trx.grand_total) || 0,
              change_due: Number(trx.change_returned) || 0,
              payment_method: trx.payment_method || 'CASH',
              payment_status: trx.payment_method === 'TEMPO' ? (Number(trx.cash_given) >= Number(trx.grand_total) ? 'PAID' : 'PENDING') : 'PAID',
              notes: trx.notes || (trx.due_date ? `Jatuh Tempo: ${trx.due_date}` : null),
              created_at: trx.created_at || new Date().toISOString(),
              synced_at: new Date().toISOString()
            };

            let { error: headerErr } = await supabase.from('transactions').upsert(trxPayload, { onConflict: 'id' });

            // If foreign key constraint violation on customer_id, fallback to customer_id = null
            if (headerErr && (headerErr.code === '23503' || headerErr.message?.includes('violates foreign key constraint'))) {
              trxPayload.customer_id = null;
              const retry = await supabase.from('transactions').upsert(trxPayload, { onConflict: 'id' });
              headerErr = retry.error;
            }

            if (headerErr) throw headerErr;

            if (trx.items && trx.items.length > 0) {
              await supabase.from('transaction_items').delete().eq('transaction_id', trx.id);
              const itemsPayload = trx.items.map((it) => ({
                transaction_id: trx.id,
                product_id: String(it.product_id),
                product_name: it.product_name,
                qty: Number(it.qty) || 1,
                unit: it.unit || 'Pcs',
                cost_price: Number(it.buy_price) || 0,
                unit_price: Number(it.price_applied) || 0,
                subtotal: Number(it.subtotal_item) || 0,
                created_at: trx.created_at || new Date().toISOString()
              }));

              const { error: itemsErr } = await supabase.from('transaction_items').insert(itemsPayload);
              if (itemsErr) console.warn('[SupabaseSync] Gagal insert items:', itemsErr.message);
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
            error_message: failedIds.length > 0 ? `Failed IDs: ${failedIds.join(', ')}` : null,
            synced_at: new Date().toISOString()
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

  /**
   * Menghapus transaksi secara real-time ke seluruh terminal (Lokal, Tab lain, LAN, dan Cloud Supabase)
   * Otomatis mengembalikan stok fisik produk yang terjual ke rak toko
   */
  async deleteTransaction(trxId: string): Promise<boolean> {
    // 1. Catat ke daftar tombstone lokal SEGERA agar tidak pernah di-re-upload lagi
    this.markTransactionDeletedLocally(trxId);

    // 2. Ambil data transaksi sebelum dihapus untuk restore stok
    const trx = await db.transactions.get(trxId);
    const updatedStocks: Array<{ id: string; stock: number }> = [];

    // 3. HAPUS DARI INDEXEDDB LOKAL & ANTREAN SYNC SEKETIKA (0ms delay)
    await db.transactions.delete(trxId);
    await db.syncQueue.delete(trxId);
    await db.receivables.where('transaction_id').equals(trxId).delete().catch(() => {});

    // 4. DISPATCH DOM EVENT LOKAL SEKETIKA agar Dashboard & Laporan langsung berkurang tanpa delay
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ketoko_transaction_deleted', { detail: { id: trxId } }));
    }

    // 5. Kembalikan stok fisik barang yang terjual di nota ini (update lokal cepat & broadcast cloud)
    if (trx && Array.isArray(trx.items)) {
      for (const item of trx.items) {
        const prodId = item.product_id;
        const addQty = Number(item.qty) || 0;
        if (prodId && addQty > 0) {
          const prod = await db.products.get(prodId);
          if (prod) {
            const restoredStock = (prod.stock || 0) + addQty;
            db.products.update(prodId, { stock: restoredStock }).catch(() => {});
            this.syncProductChange({
              ...prod,
              stock: restoredStock
            }).catch(() => {});
            updatedStocks.push({ id: prodId, stock: restoredStock });
          }
        }
      }
    }

    // 6. Siarkan ke tab/jendela lain di mesin yang sama via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ketoko_product_sync');
        bc.postMessage({ type: 'transaction_deleted', transaction_id: trxId, updated_stocks: updatedStocks });
        bc.close();
      }
    } catch {}

    // 7. Kirim hapus ke LAN Server (jika aktif)
    lanService.deleteTransaction(trxId, trx?.items).catch(() => {});

    // 8. Hapus dari Cloud Supabase & Catat Tombstone di sync_logs (secara paralel dan non-blocking)
    if (navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          Promise.allSettled([
            supabase.from('transaction_items').delete().eq('transaction_id', trxId),
            supabase.from('receivables').delete().eq('transaction_id', trxId),
            supabase.from('transactions').delete().eq('id', trxId),
            supabase.from('sync_logs').insert({
              branch_id: trx?.branch_id || 'BR-01',
              operation_type: 'DELETE_TRANSACTION',
              error_message: trxId,
              status: 'DELETED',
              synced_at: new Date().toISOString()
            })
          ]).catch(() => {});
        }
      } catch (err) {
        console.warn('[Sync] Gagal hapus transaksi dari Supabase:', err);
      }
    }

    // 9. Siarkan realtime broadcast ke semua terminal kasir di cloud (berbeda jaringan)
    this.broadcastCloudEvent('transaction_deleted', {
      transaction_id: trxId,
      updated_stocks: updatedStocks
    });
    if (updatedStocks.length > 0) {
      this.broadcastCloudEvent('stock_updated', updatedStocks);
    }

    this.notifyStatusChange();
    return true;
  }

  /**
   * Menyinkronkan perubahan produk & stok secara menyeluruh ke seluruh terminal:
   * 1. Simpan ke IndexedDB lokal (Dexie)
   * 2. Broadcast ke tab lain di browser via BroadcastChannel
   * 3. Kirim ke LAN Server terpusat (agar langsung disiarkan via SSE 'product_updated' ke semua kasir)
   * 4. Kirim ke Supabase Cloud (agar kasir online menerima pembaruan secara real-time)
   */
  async syncProductChange(product: Product): Promise<void> {
    const updatedProd: Product = {
      ...product,
      updated_at: new Date().toISOString()
    };

    // 1. Simpan langsung ke IndexedDB lokal (Dexie)
    await db.products.put(updatedProd);

    // 2. Broadcast ke tab/jendela lain di mesin yang sama
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ketoko_product_sync');
        bc.postMessage({ type: 'product_updated', product: updatedProd });
        bc.close();
      }
    } catch {}

    // 3. Kirim ke LAN Server terpusat (jika aktif)
    lanService.submitProduct(updatedProd).catch(() => {});

    // 4. Kirim ke Supabase Cloud & Broadcast ke seluruh komputer kasir/admin (berbeda jaringan)
    if (navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          // Bersihkan payload agar cocok 100% dengan kolom tabel Supabase
          const cloudPayload = {
            id: String(updatedProd.id),
            barcode: updatedProd.barcode || '',
            name: updatedProd.name,
            category: updatedProd.category || 'Kebutuhan Umum',
            buy_price: Number(updatedProd.buy_price) || 0,
            retail_price: Number(updatedProd.retail_price) || 0,
            wholesale_price: Number(updatedProd.wholesale_price) || 0,
            stock: Number(updatedProd.stock) || 0,
            unit: updatedProd.unit || 'Pcs',
            rack_location: updatedProd.rack_location || 'Rak Utama',
            image_url: updatedProd.image_url || '',
            updated_at: updatedProd.updated_at
          };

          const { error: upsertErr } = await supabase
            .from('products')
            .upsert(cloudPayload, { onConflict: 'id' });

          if (upsertErr) {
            console.warn('[Sync] Gagal upsert produk ke Supabase:', upsertErr.message);
          }

          // Siarkan langsung event real-time ke seluruh komputer kasir di jaringan mana saja
          this.broadcastCloudEvent('product_updated', updatedProd);
        }
      } catch (e) {
        console.warn('[Sync] Gagal push produk ke Supabase:', e);
      }
    }
  }

  async pullFromSupabase(): Promise<{ count: number; error?: string; products?: Product[] }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { count: 0, error: 'Supabase belum dikonfigurasi.' };
    }

    try {
      this.isSyncing = true;
      this.notifyStatusChange();

      // 1. Tarik SELURUH log produk terhapus dari Supabase sync_logs (Tombstone) dengan pagination penuh
      const deletedProductIds = this.getDeletedProductIds();
      try {
        let fromLog = 0;
        const stepLog = 1000;
        while (true) {
          const { data: remoteDeleted, error: logErr } = await supabase
            .from('sync_logs')
            .select('error_message')
            .eq('operation_type', 'DELETE_PRODUCT')
            .order('synced_at', { ascending: false })
            .range(fromLog, fromLog + stepLog - 1);

          if (logErr || !remoteDeleted || remoteDeleted.length === 0) break;

          for (const item of remoteDeleted) {
            if (item.error_message) {
              const pId = String(item.error_message).trim();
              deletedProductIds.add(pId);
              this.markProductDeletedLocally(pId);
              await db.products.delete(pId).catch(() => {});
            }
          }

          fromLog += stepLog;
          if (remoteDeleted.length < stepLog) break;
        }
      } catch (err) {
        console.warn('[Sync] Gagal tarik tombstone sync_logs:', err);
      }

      // Bersihkan produk lokal yang tercatat sudah terhapus
      for (const delId of deletedProductIds) {
        await db.products.delete(delId).catch(() => {});
      }

      // 2. Tarik SELURUH produk aktif dari Supabase dengan pagination lengkap
      let allCloudProducts: Product[] = [];
      let fromProd = 0;
      const stepProd = 1000;
      while (true) {
        const { data: cloudBatch, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true })
          .range(fromProd, fromProd + stepProd - 1);

        if (prodErr) throw prodErr;
        if (!cloudBatch || cloudBatch.length === 0) break;

        allCloudProducts = allCloudProducts.concat(cloudBatch as Product[]);
        fromProd += stepProd;
        if (cloudBatch.length < stepProd) break;
      }

      if (allCloudProducts.length > 0) {
        // Filter agar produk yang sudah dihapus TIDAK PERNAH dimasukkan kembali
        const activeProducts = allCloudProducts.filter(
          (p) => !deletedProductIds.has(String(p.id).trim())
        );

        if (activeProducts.length > 0) {
          // Bersihkan produk lokal yang tidak ada di Cloud (karena sudah dihapus di cloud)
          const cloudIdSet = new Set(activeProducts.map((p) => String(p.id).trim()));
          const currentLocalProds = await db.products.toArray();
          for (const lp of currentLocalProds) {
            const cleanLpId = String(lp.id).trim();
            if (!cloudIdSet.has(cleanLpId)) {
              await db.products.delete(cleanLpId).catch(() => {});
            }
          }

          // Simpan produk aktif terbaru ke IndexedDB dalam batch
          const chunkSize = 1000;
          for (let i = 0; i < activeProducts.length; i += chunkSize) {
            await db.products.bulkPut(activeProducts.slice(i, i + chunkSize));
          }
        }

        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem('ketoko_last_sync_time', this.lastSyncTime);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ketoko_catalog_synced', { detail: { count: activeProducts.length } }));
        }
        return { count: activeProducts.length, products: activeProducts };
      }

      return { count: 0, products: [] };
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
  ): Promise<{ success: boolean; totalUploaded: number; totalDeleted: number; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, totalUploaded: 0, totalDeleted: 0, error: 'Supabase belum dikonfigurasi.' };
    }

    try {
      this.isSyncing = true;
      this.notifyStatusChange();

      // 1. Ambil seluruh produk aktif di IndexedDB lokal komputer ini
      const allProducts = await db.products.toArray();
      const total = allProducts.length;
      const chunkSize = 200;
      let current = 0;

      // 2. Upload / Upsert seluruh produk lokal ke Supabase
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = allProducts.slice(i, i + chunkSize).map((p) => ({
          id: String(p.id),
          barcode: p.barcode || '',
          name: p.name,
          category: p.category || 'Umum',
          buy_price: Number(p.buy_price) || 0,
          retail_price: Number(p.retail_price) || 0,
          wholesale_price: Number(p.wholesale_price) || 0,
          stock: Number(p.stock) || 0,
          unit: p.unit || 'Pcs',
          rack_location: p.rack_location || 'Rak Utama',
          image_url: p.image_url || '',
          updated_at: p.updated_at || new Date().toISOString()
        }));

        const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
        if (error) throw error;

        current += chunk.length;
        onProgress?.({
          current,
          total,
          percent: Math.round((current / total) * 100)
        });
      }

      // 3. Rekonsiliasi Ground Truth: Cari produk di Supabase yang SUDAH DIHAPUS di komputer ini
      const localIdSet = new Set(allProducts.map((p) => String(p.id).trim()));
      const remoteIdsToDelete: string[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data: cloudBatch, error: listErr } = await supabase
          .from('products')
          .select('id')
          .range(from, from + step - 1);

        if (listErr || !cloudBatch || cloudBatch.length === 0) break;

        for (const item of cloudBatch) {
          const cId = String(item.id).trim();
          if (!localIdSet.has(cId)) {
            remoteIdsToDelete.push(cId);
          }
        }

        from += step;
        if (cloudBatch.length < step) break;
      }

      // 4. Hapus produk usang tersebut dari Supabase & catat tombstone di sync_logs
      let deletedCount = 0;
      if (remoteIdsToDelete.length > 0) {
        const delBatchSize = 100;
        for (let i = 0; i < remoteIdsToDelete.length; i += delBatchSize) {
          const batch = remoteIdsToDelete.slice(i, i + delBatchSize);
          await supabase.from('products').delete().in('id', batch);

          const logsToInsert = batch.map((bId) => ({
            branch_id: 'BR-01',
            operation_type: 'DELETE_PRODUCT',
            error_message: bId,
            status: 'DELETED',
            synced_at: new Date().toISOString()
          }));
          await supabase.from('sync_logs').insert(logsToInsert);
          deletedCount += batch.length;
        }
      }

      // 5. Broadcast ke seluruh komputer lain bahwa katalog telah di-refresh penuh
      await this.broadcastCloudEvent('catalog_refreshed', {
        timestamp: new Date().toISOString(),
        totalProducts: total,
        deletedProducts: deletedCount
      });

      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('ketoko_last_sync_time', this.lastSyncTime);

      return { success: true, totalUploaded: total, totalDeleted: deletedCount };
    } catch (err: any) {
      return { success: false, totalUploaded: 0, totalDeleted: 0, error: err.message };
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  async getPendingCount(): Promise<number> {
    return await db.syncQueue.count();
  }

  async getRecentTransactions(limit = 20): Promise<Transaction[]> {
    return await db.transactions.orderBy('created_at').reverse().limit(limit).toArray();
  }

  /**
   * Tarik transaksi kasir terbaru dari Cloud Supabase agar Admin bisa melihat penjualan kasir
   */
  async pullTransactionsFromSupabase(limit = 200): Promise<{ count: number; error?: string; transactions?: Transaction[] }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { count: 0, error: 'Supabase tidak aktif' };

    try {
      const { data: cloudTrx, error: trxErr } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (trxErr) throw trxErr;
      if (!cloudTrx || cloudTrx.length === 0) return { count: 0 };

      // 1. Ambil daftar transaksi yang sudah dihapus (Tombstone)
      const deletedIds = this.getDeletedTransactionIds();
      try {
        const { data: remoteDeleted } = await supabase
          .from('sync_logs')
          .select('error_message')
          .eq('operation_type', 'DELETE_TRANSACTION')
          .order('synced_at', { ascending: false })
          .limit(100);

        if (remoteDeleted && remoteDeleted.length > 0) {
          for (const item of remoteDeleted) {
            if (item.error_message) {
              deletedIds.add(item.error_message);
              this.markTransactionDeletedLocally(item.error_message);
              await db.transactions.delete(item.error_message).catch(() => {});
              await db.syncQueue.delete(item.error_message).catch(() => {});
            }
          }
        }
      } catch {}

      // 2. Filter hanya transaksi yang tidak dihapus
      const activeCloudTrx = cloudTrx.filter(t => !deletedIds.has(String(t.id)));
      if (activeCloudTrx.length === 0) return { count: 0, transactions: [] };

      const trxIds = activeCloudTrx.map(t => t.id);

      // Ambil detail items transaksi
      const { data: cloudItems, error: itemsErr } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', trxIds);

      if (itemsErr) console.warn('[SyncService] Gagal ambil items transaksi:', itemsErr);

      const itemsMap = new Map<string, any[]>();
      if (cloudItems) {
        for (const item of cloudItems) {
          const list = itemsMap.get(item.transaction_id) || [];
          list.push({
            product_id: String(item.product_id),
            product_name: item.product_name,
            qty: Number(item.qty) || 1,
            unit: item.unit || 'Pcs',
            buy_price: Number(item.cost_price) || 0,
            price_applied: Number(item.unit_price) || 0,
            is_wholesale: false,
            subtotal_item: Number(item.subtotal) || 0
          });
          itemsMap.set(item.transaction_id, list);
        }
      }

      const formatted: Transaction[] = [];
      for (const t of activeCloudTrx) {
        const existing = await db.transactions.get(t.id);
        const cloudItemDetails = itemsMap.get(t.id);
        const resolvedItems = (cloudItemDetails && cloudItemDetails.length > 0)
          ? cloudItemDetails
          : (existing?.items && existing.items.length > 0 ? existing.items : []);

        formatted.push({
          id: String(t.id),
          receipt_number: t.receipt_number || `TRX-${t.id}`,
          branch_id: t.branch_id || 'BR-01',
          cashier_id: t.cashier_id || 'KASIR-01',
          cashier_name: t.cashier_name || 'Kasir',
          member_id: t.customer_id || undefined,
          customer_name: t.customer_name || (t.customer_id ? `Member #${t.customer_id}` : undefined),
          notes: t.notes || undefined,
          due_date: t.notes && t.notes.includes('Jatuh Tempo:') ? t.notes.split('Jatuh Tempo:')[1].trim() : undefined,
          items: resolvedItems,
          subtotal: Number(t.subtotal) || Number(t.grand_total) || 0,
          discount_amount: Number(t.discount_amount) || 0,
          tax_amount: Number(t.tax_amount) || 0,
          grand_total: Number(t.grand_total) || 0,
          cash_given: Number(t.cash_given) || Number(t.grand_total) || 0,
          change_returned: Number(t.change_due) || 0,
          payment_method: (t.payment_method || 'CASH') as any,
          created_at: t.created_at || new Date().toISOString(),
          synced: true,
          synced_at: t.synced_at || new Date().toISOString()
        });
      }

      await db.transactions.bulkPut(formatted);
      if (typeof window !== 'undefined' && formatted.length > 0) {
        window.dispatchEvent(new CustomEvent('ketoko_transactions_refreshed', { detail: { count: formatted.length } }));
      }
      return { count: formatted.length, transactions: formatted };
    } catch (err: any) {
      console.warn('[SyncService] Gagal tarik transaksi dari Supabase:', err.message);
      return { count: 0, error: err.message };
    }
  }

  /**
   * Upload faktur pembelian barang ke Cloud Supabase
   */
  async pushPurchaseToSupabase(purchase: any): Promise<boolean> {
    // Siarkan event ke seluruh komputer kasir/admin di jaringan berbeda
    this.broadcastCloudEvent('purchase_created', purchase);

    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('purchases').upsert({
        id: purchase.id,
        invoice_number: purchase.invoice_number,
        supplier_id: purchase.supplier_id,
        supplier_name: purchase.supplier_name,
        date: purchase.date,
        payment_type: purchase.payment_type || 'CASH',
        due_date: purchase.due_date || null,
        subtotal: purchase.subtotal || purchase.total,
        discount: purchase.discount || 0,
        total: purchase.total,
        status: purchase.status || 'RECEIVED',
        cashier_name: purchase.cashier_name || 'Admin',
        notes: purchase.notes || null,
        items: purchase.items || [],
        created_at: purchase.created_at || new Date().toISOString()
      });

      if (error) {
        console.warn('[SyncService] Gagal upload pembelian ke Supabase (tabel purchases mungkin belum ada):', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tarik data pembelian barang dari Cloud Supabase
   */
  async pullPurchasesFromSupabase(limit = 100): Promise<{ count: number }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { count: 0 };

    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data || data.length === 0) return { count: 0 };

      const parsedPurchases = data.map((p: any) => ({
        id: p.id,
        invoice_number: p.invoice_number,
        supplier_id: p.supplier_id,
        supplier_name: p.supplier_name,
        date: p.date,
        payment_type: p.payment_type,
        due_date: p.due_date,
        subtotal: p.subtotal,
        discount: p.discount,
        total: p.total,
        status: p.status,
        cashier_name: p.cashier_name,
        notes: p.notes,
        items: Array.isArray(p.items) ? p.items : (typeof p.items === 'string' ? JSON.parse(p.items) : []),
        created_at: p.created_at
      }));

      await db.purchases.bulkPut(parsedPurchases);
      return { count: parsedPurchases.length };
    } catch {
      return { count: 0 };
    }
  }

  /**
   * Sinkronisasi Hutang & Piutang dengan Supabase
   */
  async syncDebtsAndReceivables(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 1. Push local debts
      const localDebts = await db.debts.toArray();
      if (localDebts.length > 0) {
        for (const d of localDebts) {
          if (d.supplier_id) {
            await this.ensureSupplierExists(supabase, d.supplier_id, d.supplier_name);
          }
        }

        const debtsPayload = localDebts.map(d => ({
          id: d.id,
          supplier_id: d.supplier_id || null,
          supplier_name: d.supplier_name || 'Supplier Umum',
          invoice_number: d.invoice_number,
          amount: Number(d.total_amount) || 0,
          paid_amount: Number(d.paid_amount) || 0,
          due_date: d.due_date,
          status: d.status,
          notes: d.notes,
          created_at: d.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        let { error: dErr } = await supabase.from('debts').upsert(debtsPayload, { onConflict: 'id' });
        if (dErr && (dErr.code === '23503' || dErr.message?.includes('violates foreign key constraint'))) {
          const fallbackDebts = debtsPayload.map(d => ({ ...d, supplier_id: null }));
          await supabase.from('debts').upsert(fallbackDebts, { onConflict: 'id' });
        }
      }

      // 2. Pull cloud debts
      const { data: cloudDebts } = await supabase.from('debts').select('*');
      if (cloudDebts && cloudDebts.length > 0) {
        await db.debts.bulkPut(cloudDebts.map((d: any) => ({
          id: d.id,
          supplier_id: d.supplier_id || undefined,
          supplier_name: d.supplier_name,
          invoice_number: d.invoice_number,
          total_amount: Number(d.amount) || 0,
          paid_amount: Number(d.paid_amount) || 0,
          remaining_amount: Math.max(0, (Number(d.amount) || 0) - (Number(d.paid_amount) || 0)),
          due_date: d.due_date,
          status: d.status,
          notes: d.notes,
          created_at: d.created_at
        })));
      }

      // 3. Push local receivables
      const localRecs = await db.receivables.toArray();
      if (localRecs.length > 0) {
        for (const r of localRecs) {
          if (r.customer_id) {
            await this.ensureCustomerExists(supabase, r.customer_id, r.customer_name);
          }
        }

        const recsPayload = localRecs.map(r => ({
          id: r.id,
          customer_id: r.customer_id || null,
          customer_name: r.customer_name || 'Pelanggan Umum',
          transaction_id: r.transaction_id || null,
          receipt_number: r.receipt_number,
          amount: Number(r.total_amount) || 0,
          paid_amount: Number(r.paid_amount) || 0,
          due_date: r.due_date,
          status: r.status,
          notes: r.notes,
          created_at: r.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        let { error: rErr } = await supabase.from('receivables').upsert(recsPayload, { onConflict: 'id' });
        if (rErr && (rErr.code === '23503' || rErr.message?.includes('violates foreign key constraint'))) {
          const fallbackRecs = recsPayload.map(r => ({ ...r, customer_id: null }));
          await supabase.from('receivables').upsert(fallbackRecs, { onConflict: 'id' });
        }
      }

      // 4. Pull cloud receivables
      const { data: cloudRecs } = await supabase.from('receivables').select('*');
      if (cloudRecs && cloudRecs.length > 0) {
        await db.receivables.bulkPut(cloudRecs.map((r: any) => ({
          id: r.id,
          customer_id: r.customer_id || undefined,
          customer_name: r.customer_name,
          transaction_id: r.transaction_id || undefined,
          receipt_number: r.receipt_number,
          total_amount: Number(r.amount) || 0,
          paid_amount: Number(r.paid_amount) || 0,
          remaining_amount: Math.max(0, (Number(r.amount) || 0) - (Number(r.paid_amount) || 0)),
          due_date: r.due_date,
          status: r.status,
          notes: r.notes,
          created_at: r.created_at
        })));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ketoko_debt_receivable_updated'));
      }
      this.broadcastCloudEvent('debt_receivable_updated', { timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.warn('[SyncService] Gagal sinkron hutang piutang:', err.message);
    }
  }

  /**
   * Sinkronkan seluruh data (Master Barang, Transaksi Kasir, Pembelian, Hutang Piutang)
   */
  async syncAllData(): Promise<{ success: boolean; message: string }> {
    try {
      this.isSyncing = true;
      this.notifyStatusChange();

      // Jalankan seluruh modul sinkronisasi tanpa saling memblokir jika salah satu gagal
      await this.pushLocalTransactionsToSupabase().catch((err) => console.warn('[Sync] pushLocal failed:', err));
      await this.reconcileQueue().catch((err) => console.warn('[Sync] reconcileQueue failed:', err));
      await this.pullTransactionsFromSupabase().catch((err) => console.warn('[Sync] pullTransactions failed:', err));
      await this.pullFromSupabase().catch((err) => console.warn('[Sync] pullProducts failed:', err));
      await this.pullPurchasesFromSupabase().catch((err) => console.warn('[Sync] pullPurchases failed:', err));
      await this.syncDebtsAndReceivables().catch((err) => console.warn('[Sync] syncDebts failed:', err));

      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('ketoko_last_sync_time', this.lastSyncTime);
      this.notifyStatusChange();

      return { success: true, message: 'Semua data berhasil disinkronkan dengan Cloud' };
    } catch (err: any) {
      return { success: false, message: 'Sinkronisasi gagal: ' + err.message };
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }
}

export const syncService = new SyncService();
