-- ==============================================================================
-- KETOKO POS — SUPABASE DATABASE SCHEMA
-- Arsitektur Hybrid: Sinkronisasi Cloud untuk Transaksi, Master Barang & Mitra
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL PROFIL & PENGATURAN TOKO
CREATE TABLE IF NOT EXISTS store_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL DEFAULT 'Ketoko POS',
    branch_name TEXT DEFAULT 'Cabang Samarinda (BR-01)',
    tagline TEXT DEFAULT 'Solusi Belanja Hemat, Cepat & Terlengkap',
    address TEXT DEFAULT 'Jl. Pahlawan No. 45, Samarinda, Kalimantan Timur',
    phone TEXT DEFAULT '0812-3456-7890',
    npwp TEXT DEFAULT '01.234.567.8-721.000',
    footer_message TEXT DEFAULT 'Terima kasih atas kunjungan Anda!',
    logo_base64 TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABEL MASTER PRODUK (24.500+ ITEM)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Kebutuhan Umum',
    buy_price NUMERIC(15, 2) DEFAULT 0,
    retail_price NUMERIC(15, 2) DEFAULT 0,
    wholesale_price NUMERIC(15, 2) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'Pcs',
    rack_location TEXT DEFAULT 'Rak Utama',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks Pencarian Cepat Produk di Cloud
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

-- 4. TABEL PELANGGAN (CUSTOMERS)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    type TEXT DEFAULT 'RETAIL', -- 'RETAIL' | 'MEMBER' | 'WHOLESALE'
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    current_debt NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- 5. TABEL SUPPLIER
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    current_payable NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- 6. TABEL TRANSAKSI KASIR (HEADER)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    receipt_number TEXT NOT NULL,
    branch_id TEXT DEFAULT 'BR-01',
    cashier_id TEXT,
    cashier_name TEXT,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cash_given NUMERIC(15, 2) DEFAULT 0,
    change_due NUMERIC(15, 2) DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH', -- 'CASH' | 'QRIS' | 'TRANSFER' | 'DEBT'
    payment_status TEXT DEFAULT 'PAID',  -- 'PAID' | 'PARTIAL' | 'UNPAID'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_number ON transactions(receipt_number);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);

-- 7. TABEL ITEM TRANSAKSI (DETAIL PENJUALAN)
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    barcode TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'Pcs',
    cost_price NUMERIC(15, 2) DEFAULT 0,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trx_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_trx_items_product_id ON transaction_items(product_id);

-- 8. TABEL HUTANG KE SUPPLIER (DEBTS / ACCOUNTS PAYABLE)
CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    invoice_number TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    due_date DATE,
    status TEXT DEFAULT 'UNPAID', -- 'UNPAID' | 'PARTIAL' | 'PAID'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_debts_supplier_id ON debts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);

-- 9. TABEL PIUTANG PELANGGAN (RECEIVABLES / ACCOUNTS RECEIVABLE)
CREATE TABLE IF NOT EXISTS receivables (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    receipt_number TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    due_date DATE,
    status TEXT DEFAULT 'UNPAID', -- 'UNPAID' | 'PARTIAL' | 'PAID'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receivables_customer_id ON receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);

-- 10. TABEL AUDIT LOG SINKRONISASI (SYNC_LOGS)
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id TEXT DEFAULT 'BR-01',
    device_id TEXT,
    operation_type TEXT NOT NULL, -- 'PUSH_TRANSACTIONS' | 'PULL_CATALOG' | 'MANUAL_SYNC'
    synced_records_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'SUCCESS', -- 'SUCCESS' | 'PARTIAL' | 'FAILED'
    error_message TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_synced_at ON sync_logs(synced_at);

-- 11. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses Anon / Public untuk POS Client
CREATE POLICY "Allow public read/write store_settings" ON store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write transaction_items" ON transaction_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write debts" ON debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write receivables" ON receivables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write sync_logs" ON sync_logs FOR ALL USING (true) WITH CHECK (true);

-- 12. TRIGGER OTOMATIS: AUTO DEDUCT STOCK ON TRANSACTION ITEM INSERT
CREATE OR REPLACE FUNCTION deduct_product_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET stock = GREATEST(0, stock - NEW.qty),
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_stock ON transaction_items;
CREATE TRIGGER trg_deduct_stock
AFTER INSERT ON transaction_items
FOR EACH ROW
EXECUTE FUNCTION deduct_product_stock_on_sale();
