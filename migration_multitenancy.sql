-- ==============================================================================
-- KETOKO POS — MULTI-TENANCY MIGRATION SCRIPT
-- Menambahkan kolom store_id ke seluruh tabel di Supabase
-- Menjamin data Toko Utama (store-01) tetap utuh dan terpisah 100% dari toko baru
-- ==============================================================================

-- 1. Tambah kolom store_id ke tabel products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);

-- 2. Tambah kolom store_id ke tabel transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON public.transactions(store_id);

-- 3. Tambah kolom store_id ke tabel transaction_items
ALTER TABLE public.transaction_items 
ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
CREATE INDEX IF NOT EXISTS idx_transaction_items_store_id ON public.transaction_items(store_id);

-- 4. Tambah kolom store_id ke tabel customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);

-- 5. Tambah kolom store_id ke tabel suppliers
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
CREATE INDEX IF NOT EXISTS idx_suppliers_store_id ON public.suppliers(store_id);

-- 6. Tambah kolom store_id ke tabel purchases jika tabel sudah ada
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchases') THEN
        ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
        CREATE INDEX IF NOT EXISTS idx_purchases_store_id ON public.purchases(store_id);
    END IF;
END $$;

-- 7. Tambah kolom store_id ke tabel debts & receivables jika tabel sudah ada
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'debts') THEN
        ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
        CREATE INDEX IF NOT EXISTS idx_debts_store_id ON public.debts(store_id);
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'receivables') THEN
        ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
        CREATE INDEX IF NOT EXISTS idx_receivables_store_id ON public.receivables(store_id);
    END IF;
END $$;

-- 8. Tambah kolom store_id ke tabel sync_logs jika tabel sudah ada
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sync_logs') THEN
        ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'store-01';
        CREATE INDEX IF NOT EXISTS idx_sync_logs_store_id ON public.sync_logs(store_id);
    END IF;
END $$;

-- 9. Pastikan data produk lama yang belum punya store_id terisi 'store-01'
UPDATE public.products SET store_id = 'store-01' WHERE store_id IS NULL OR store_id = '';
UPDATE public.transactions SET store_id = 'store-01' WHERE store_id IS NULL OR store_id = '';

