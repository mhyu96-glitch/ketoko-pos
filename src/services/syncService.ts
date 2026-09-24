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

export class SyncService {
  private isSyncing = false;
  private lastSyncTime: string | null = localStorage.getItem('ketoko_last_sync_time');
  private lastError: string | null = null;
  private cloudLiveChannel: any = null;

  public getCloudLiveChannel() {
    if (this.cloudLiveChannel) return this.cloudLiveChannel;
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    this.cloudLiveChannel = supabase.channel('ketoko_global_live_sync');
    this.cloudLiveChannel.subscribe();
    return this.cloudLiveChannel;
  }

  public broadcastCloudEvent(event: string, payload: any) {
    try {
      const ch = this.getCloudLiveChannel();
      if (ch) {
        ch.send({
          type: 'broadcast',
          event,
          payload
        });
      }
    } catch (err) {
      console.warn('[Sync] Broadcast cloud event error:', err);
    }
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

    // Broadcast ke komputer admin/kasir lain di cloud (jaringan berbeda)
    this.broadcastCloudEvent('transaction_created', {
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

  /**
   * Menghapus transaksi secara real-time ke seluruh terminal (Lokal, Tab lain, LAN, dan Cloud Supabase)
   * Otomatis mengembalikan stok fisik produk yang terjual ke rak toko
   */
  async deleteTransaction(trxId: string): Promise<boolean> {
    const trx = await db.transactions.get(trxId);
    const updatedStocks: Array<{ id: string; stock: number }> = [];

    // 1. Kembalikan stok fisik barang yang terjual di nota ini
    if (trx && Array.isArray(trx.items)) {
      for (const item of trx.items) {
        const prodId = item.product_id;
        const addQty = Number(item.qty) || 0;
        if (prodId && addQty > 0) {
          const prod = await db.products.get(prodId);
          if (prod) {
            const restoredStock = (prod.stock || 0) + addQty;
            await this.syncProductChange({
              ...prod,
              stock: restoredStock
            });
            updatedStocks.push({ id: prodId, stock: restoredStock });
          }
        }
      }
    }

    // 2. Hapus dari IndexedDB lokal & antrean sync
    await db.transactions.delete(trxId);
    await db.syncQueue.delete(trxId);

    // 3. Siarkan ke tab/jendela lain di mesin yang sama via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ketoko_product_sync');
        bc.postMessage({ type: 'transaction_deleted', transaction_id: trxId, updated_stocks: updatedStocks });
        bc.close();
      }
    } catch {}

    // 4. Kirim hapus ke LAN Server (jika aktif)
    lanService.deleteTransaction(trxId, trx?.items).catch(() => {});

    // 5. Hapus dari Cloud Supabase & Broadcast ke seluruh komputer lain (berbeda jaringan)
    if (navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase.from('transaction_items').delete().eq('transaction_id', trxId);
          await supabase.from('transactions').delete().eq('id', trxId);
        }
      } catch (err) {
        console.warn('[Sync] Gagal hapus transaksi dari Supabase:', err);
      }
    }

    // Siarkan realtime broadcast ke semua kasir di cloud
    this.broadcastCloudEvent('transaction_deleted', {
      transaction_id: trxId,
      updated_stocks: updatedStocks
    });
    if (updatedStocks.length > 0) {
      this.broadcastCloudEvent('stock_updated', updatedStocks);
    }

    // Dispatch DOM event untuk komponen lokal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ketoko_transaction_deleted', { detail: { id: trxId } }));
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

  /**
   * Tarik transaksi kasir terbaru dari Cloud Supabase agar Admin bisa melihat penjualan kasir
   */
  async pullTransactionsFromSupabase(limit = 200): Promise<{ count: number; error?: string }> {
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

      const trxIds = cloudTrx.map(t => t.id);

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
            product_id: item.product_id,
            product_name: item.product_name,
            qty: item.qty,
            buy_price: item.cost_price,
            price_applied: item.unit_price,
            is_wholesale: false,
            subtotal_item: item.subtotal
          });
          itemsMap.set(item.transaction_id, list);
        }
      }

      const formatted: Transaction[] = cloudTrx.map(t => ({
        id: t.id,
        receipt_number: t.receipt_number,
        branch_id: t.branch_id || 'BR-01',
        cashier_id: t.cashier_id || 'KASIR-01',
        cashier_name: t.cashier_name || 'Kasir',
        member_id: t.customer_id || undefined,
        items: itemsMap.get(t.id) || [],
        subtotal: Number(t.subtotal) || 0,
        discount_amount: Number(t.discount_amount) || 0,
        tax_amount: Number(t.tax_amount) || 0,
        grand_total: Number(t.grand_total) || 0,
        cash_given: Number(t.cash_given) || Number(t.grand_total) || 0,
        change_returned: Number(t.change_due) || 0,
        payment_method: (t.payment_method || 'CASH') as any,
        created_at: t.created_at,
        synced: true,
        synced_at: t.synced_at
      }));

      await db.transactions.bulkPut(formatted);
      return { count: formatted.length };
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
        await supabase.from('debts').upsert(localDebts.map(d => ({
          id: d.id,
          supplier_id: d.supplier_id,
          supplier_name: d.supplier_name,
          invoice_number: d.invoice_number,
          amount: d.total_amount,
          paid_amount: d.paid_amount,
          due_date: d.due_date,
          status: d.status,
          notes: d.notes,
          created_at: d.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })));
      }

      // 2. Pull cloud debts
      const { data: cloudDebts } = await supabase.from('debts').select('*');
      if (cloudDebts && cloudDebts.length > 0) {
        await db.debts.bulkPut(cloudDebts.map((d: any) => ({
          id: d.id,
          supplier_id: d.supplier_id,
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
        await supabase.from('receivables').upsert(localRecs.map(r => ({
          id: r.id,
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          transaction_id: r.transaction_id,
          receipt_number: r.receipt_number,
          amount: r.total_amount,
          paid_amount: r.paid_amount,
          due_date: r.due_date,
          status: r.status,
          notes: r.notes,
          created_at: r.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })));
      }

      // 4. Pull cloud receivables
      const { data: cloudRecs } = await supabase.from('receivables').select('*');
      if (cloudRecs && cloudRecs.length > 0) {
        await db.receivables.bulkPut(cloudRecs.map((r: any) => ({
          id: r.id,
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          transaction_id: r.transaction_id,
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

      // Upload antrean pending transaksi dulu
      await this.reconcileQueue();

      // Tarik transaksi terbaru kasir
      await this.pullTransactionsFromSupabase();

      // Tarik katalog produk terbaru
      await this.pullFromSupabase();

      // Tarik data pembelian
      await this.pullPurchasesFromSupabase();

      // Sinkron hutang piutang
      await this.syncDebtsAndReceivables();

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
