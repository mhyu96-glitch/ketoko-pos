const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

let serverInstance = null;
let sqliteDb = null;
let sseClients = [];
let currentPort = 5858;
let currentDistPath = '';
let currentDataDir = '';

// ================= CLOUDFLARE TUNNEL (ONLINE ACCESS) =================
let tunnelProcess = null;
let tunnelUrl = null;
let tunnelError = null;
let tunnelStatus = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'

function startCloudflareTunnel(port = currentPort) {
  if (tunnelProcess) {
    return { status: tunnelStatus, url: tunnelUrl };
  }
  tunnelStatus = 'starting';
  tunnelError = null;
  tunnelUrl = null;

  try {
    tunnelProcess = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

    const onData = (chunk) => {
      const text = chunk.toString();
      const match = text.match(urlRegex);
      if (match && !tunnelUrl) {
        tunnelUrl = match[0];
        tunnelStatus = 'running';
        console.log('\n=============================================================');
        console.log('  🌐 CLOUDFLARE TUNNEL AKTIF (ONLINE INTERNET PUBLIK)');
        console.log('  🔗 URL:', tunnelUrl);
        console.log('=============================================================\n');
        broadcastSseEvent('tunnel_updated', { status: tunnelStatus, url: tunnelUrl });
      }
    };

    tunnelProcess.stdout.on('data', onData);
    tunnelProcess.stderr.on('data', onData);

    tunnelProcess.on('close', (code) => {
      console.log('[Cloudflare Tunnel] Ditutup dengan kode:', code);
      tunnelProcess = null;
      tunnelStatus = 'stopped';
      tunnelUrl = null;
      broadcastSseEvent('tunnel_updated', { status: 'stopped', url: null });
    });

    tunnelProcess.on('error', (err) => {
      console.error('[Cloudflare Tunnel] Error:', err);
      tunnelError = err.message;
      tunnelStatus = 'error';
      tunnelProcess = null;
      tunnelUrl = null;
      broadcastSseEvent('tunnel_updated', { status: 'error', error: err.message });
    });

    return { status: 'starting' };
  } catch (err) {
    tunnelStatus = 'error';
    tunnelError = err.message;
    return { status: 'error', error: err.message };
  }
}

function stopCloudflareTunnel() {
  if (tunnelProcess) {
    try {
      tunnelProcess.kill('SIGTERM');
    } catch {}
    tunnelProcess = null;
  }
  tunnelStatus = 'stopped';
  tunnelUrl = null;
  broadcastSseEvent('tunnel_updated', { status: 'stopped', url: null });
  return { status: 'stopped' };
}

function getTunnelInfo() {
  return {
    status: tunnelStatus,
    url: tunnelUrl,
    error: tunnelError
  };
}

/**
 * Deteksi seluruh alamat IPv4 lokal non-internal (LAN / Wi-Fi)
 */
function getLanIpAddresses() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const dev in ifaces) {
    for (const details of ifaces[dev]) {
      if (details.family === 'IPv4' && !details.internal) {
        ips.push({
          iface: dev,
          address: details.address,
          url: `http://${details.address}:${currentPort}`
        });
      }
    }
  }
  return ips;
}

/**
 * Inisialisasi Database SQLite Terpusat di Server
 */
function initCentralDatabase(dataDir) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'ketoko_central.sqlite');
  console.log('[LAN Server] Menggunakan Database Terpusat:', dbPath);

  sqliteDb = new DatabaseSync(dbPath);

  // Performance optimizations (WAL Mode for high concurrency)
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);

  // Tabel Master Produk & Live Stock
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Umum',
      buy_price REAL DEFAULT 0,
      retail_price REAL DEFAULT 0,
      wholesale_price REAL DEFAULT 0,
      min_wholesale_qty INTEGER DEFAULT 1,
      stock REAL DEFAULT 0,
      unit TEXT DEFAULT 'Pcs',
      rack_location TEXT DEFAULT '',
      min_stock_alert INTEGER DEFAULT 5,
      image_url TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  `);

  // Tabel Transaksi Penjualan Terpusat
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      receipt_number TEXT NOT NULL,
      cashier_id TEXT,
      cashier_name TEXT,
      terminal_id TEXT DEFAULT 'SERVER',
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'CASH',
      cash_given REAL DEFAULT 0,
      change_returned REAL DEFAULT 0,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_trx_created_at ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_trx_receipt ON transactions(receipt_number);
  `);

  // Tabel Pembelian Barang (Restock / Faktur Supplier) Terpusat
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      supplier_id TEXT,
      supplier_name TEXT NOT NULL,
      date TEXT NOT NULL,
      payment_type TEXT DEFAULT 'CASH',
      due_date TEXT,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'RECEIVED',
      cashier_name TEXT,
      notes TEXT,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pur_created_at ON purchases(created_at);
  `);

  // Tabel Profil Toko & Pengaturan
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS store_profile (
      key TEXT PRIMARY KEY,
      value_json TEXT
    );
  `);

  // Inisialisasi Profil Toko Default jika kosong
  const checkProfile = sqliteDb.prepare("SELECT value_json FROM store_profile WHERE key = 'profile'").get();
  if (!checkProfile) {
    const defaultProfile = {
      name: 'CV. Tumbuh Makmur Air Conindo',
      branch_name: 'Cabang Samarinda',
      tagline: 'Solusi Pendingin Ruangan & Elektronik Terpercaya',
      address: 'Jl. P Antasari No.106, Air Putih, Kec. Samarinda Ulu, Kota Samarinda, Kalimantan Timur 75243',
      phone: '0811 5121 215',
      footer_message: 'Terima kasih telah berbelanja di CV. Tumbuh Makmur Air Conindo!',
      logo_base64: '',
      npwp: '01.234.567.8-721.000'
    };
    sqliteDb.prepare("INSERT INTO store_profile (key, value_json) VALUES ('profile', ?)").run(JSON.stringify(defaultProfile));
  }

  // Jika produk masih kosong, muat seed data dari products.json jika tersedia
  const prodCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (prodCount === 0) {
    try {
      const candidates = [
        path.join(__dirname, '../public/data/products.json'),
        path.join(__dirname, '../dist/data/products.json'),
        path.join(process.cwd(), 'public/data/products.json'),
        path.join(process.cwd(), 'dist/data/products.json')
      ];
      let seedFile = candidates.find(f => fs.existsSync(f));
      if (seedFile) {
        const raw = fs.readFileSync(seedFile, 'utf-8');
        const prods = JSON.parse(raw);
        if (Array.isArray(prods) && prods.length > 0) {
          console.log(`[LAN Server] Mengimpor ${prods.length} produk awal ke SQLite terpusat...`);
          sqliteDb.exec('BEGIN TRANSACTION;');
          const insertStmt = sqliteDb.prepare(`
            INSERT OR REPLACE INTO products (
              id, barcode, name, category, buy_price, retail_price, 
              wholesale_price, min_wholesale_qty, stock, unit, rack_location, min_stock_alert, image_url, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of prods) {
            insertStmt.run(
              p.id || `BRG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              p.barcode || '',
              p.name || 'Produk',
              p.category || 'Umum',
              Number(p.buy_price) || 0,
              Number(p.retail_price) || 0,
              Number(p.wholesale_price) || Number(p.retail_price) || 0,
              Number(p.min_wholesale_qty) || 1,
              Number(p.stock) || 0,
              p.unit || 'Pcs',
              p.rack_location || '',
              Number(p.min_stock_alert) || 5,
              p.image_url || '',
              p.updated_at || new Date().toISOString()
            );
          }
          sqliteDb.exec('COMMIT;');
          console.log('[LAN Server] Berhasil mengimpor produk ke database terpusat!');
        }
      }
    } catch (err) {
      console.warn('[LAN Server] Peringatan saat inisialisasi produk awal:', err.message);
    }
  }
}

/**
 * Broadcast event ke seluruh koneksi kasir klien via Server-Sent Events (SSE)
 */
function broadcastSseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((res) => {
    try {
      res.write(payload);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Handle HTTP Requests
 */
function handleHttpRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // CORS Headers untuk akses dari browser klien LAN
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Terminal-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Helper untuk kirim JSON response
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  // Helper untuk membaca request body JSON
  const readJsonBody = (cb) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // Max 10MB
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload terlalu besar' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        cb(parsed);
      } catch (err) {
        sendJson(400, { error: 'Format JSON tidak valid: ' + err.message });
      }
    });
  };

  // ================= API ENDPOINTS =================

  // 1. Status Server & Informasi Jaringan
  if (pathname === '/api/lan/status' && req.method === 'GET') {
    const prodCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const trxCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
    const profileRow = sqliteDb.prepare("SELECT value_json FROM store_profile WHERE key = 'profile'").get();
    const profile = profileRow ? JSON.parse(profileRow.value_json) : null;

    return sendJson(200, {
      status: 'online',
      server_name: 'Ketoko POS Central LAN Server',
      version: '1.0.0',
      port: currentPort,
      ip_addresses: getLanIpAddresses(),
      connected_clients: sseClients.length,
      total_products: prodCount,
      total_transactions: trxCount,
      store_profile: profile,
      timestamp: new Date().toISOString()
    });
  }

  // 2. Real-time Event Stream (Server-Sent Events)
  if (pathname === '/api/lan/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);

    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // 3. Mengambil Semua Produk & Live Stock
  if (pathname === '/api/lan/products' && req.method === 'GET') {
    const products = sqliteDb.prepare('SELECT * FROM products ORDER BY name ASC').all();
    return sendJson(200, {
      status: 'success',
      count: products.length,
      data: products
    });
  }

  // 4. Tambah / Update Produk Terpusat
  if (pathname === '/api/lan/products' && req.method === 'POST') {
    return readJsonBody((product) => {
      if (!product || (!product.id && !product.name)) {
        return sendJson(400, { error: 'Data produk tidak lengkap' });
      }

      const id = product.id || `BRG-${Date.now()}`;
      const existing = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(id);

      const name = product.name || (existing ? existing.name : 'Produk');
      const barcode = product.barcode !== undefined ? product.barcode : (existing ? existing.barcode : '');
      const category = product.category || (existing ? existing.category : 'Umum');
      const buy_price = product.buy_price !== undefined ? Number(product.buy_price) : (existing ? existing.buy_price : 0);
      const retail_price = product.retail_price !== undefined ? Number(product.retail_price) : (existing ? existing.retail_price : 0);
      const wholesale_price = product.wholesale_price !== undefined ? Number(product.wholesale_price) : (existing ? existing.wholesale_price : retail_price);
      const min_wholesale_qty = product.min_wholesale_qty !== undefined ? Number(product.min_wholesale_qty) : (existing ? existing.min_wholesale_qty : 1);
      const stock = product.stock !== undefined ? Number(product.stock) : (existing ? existing.stock : 0);
      const unit = product.unit || (existing ? existing.unit : 'Pcs');
      const rack_location = product.rack_location !== undefined ? product.rack_location : (existing ? existing.rack_location : '');
      const min_stock_alert = product.min_stock_alert !== undefined ? Number(product.min_stock_alert) : (existing ? existing.min_stock_alert : 5);
      const image_url = product.image_url !== undefined ? product.image_url : (existing ? existing.image_url : '');
      const updated_at = product.updated_at || new Date().toISOString();

      const stmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO products (
          id, barcode, name, category, buy_price, retail_price, 
          wholesale_price, min_wholesale_qty, stock, unit, rack_location, min_stock_alert, image_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        barcode,
        name,
        category,
        buy_price,
        retail_price,
        wholesale_price,
        min_wholesale_qty,
        stock,
        unit,
        rack_location,
        min_stock_alert,
        image_url,
        updated_at
      );

      const saved = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(id);

      // Broadcast update ke semua kasir klien via SSE
      broadcastSseEvent('product_updated', saved);

      return sendJson(200, { status: 'success', data: saved });
    });
  }

  // 5. Simpan Transaksi Penjualan dari Kasir Klien (Atomic Stock Deduction)
  if (pathname === '/api/lan/transactions' && req.method === 'POST') {
    return readJsonBody((trx) => {
      if (!trx || !trx.items || !Array.isArray(trx.items) || trx.items.length === 0) {
        return sendJson(400, { error: 'Data transaksi atau item belanja tidak valid' });
      }

      const trxId = trx.id || `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const terminalId = req.headers['x-terminal-id'] || trx.terminal_id || 'KASIR-LAN';
      const createdAt = trx.created_at || new Date().toISOString();

      try {
        sqliteDb.exec('BEGIN TRANSACTION;');

        // 1. Simpan Transaksi Header
        const insertTrx = sqliteDb.prepare(`
          INSERT INTO transactions (
            id, receipt_number, cashier_id, cashier_name, terminal_id,
            subtotal, discount_amount, tax_amount, grand_total, payment_method,
            cash_given, change_returned, items_json, created_at, synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        insertTrx.run(
          trxId,
          trx.receipt_number || `NOTA-${Date.now().toString().slice(-6)}`,
          trx.cashier_id || 'KASIR-01',
          trx.cashier_name || 'Kasir Toko',
          terminalId,
          Number(trx.subtotal) || 0,
          Number(trx.discount_amount) || 0,
          Number(trx.tax_amount) || 0,
          Number(trx.grand_total) || 0,
          trx.payment_method || 'CASH',
          Number(trx.cash_given) || Number(trx.grand_total) || 0,
          Number(trx.change_returned) || 0,
          JSON.stringify(trx.items),
          createdAt
        );

        // 2. Potong Stok Produk secara Atomik
        const updateStockStmt = sqliteDb.prepare(`
          UPDATE products 
          SET stock = MAX(0, stock - ?), updated_at = ?
          WHERE id = ?
        `);

        const getStockStmt = sqliteDb.prepare('SELECT id, stock FROM products WHERE id = ?');
        const updatedStocks = [];

        for (const item of trx.items) {
          const prodId = item.product_id || item.id;
          const qty = Number(item.qty) || 1;
          if (prodId) {
            updateStockStmt.run(qty, createdAt, prodId);
            const current = getStockStmt.get(prodId);
            if (current) {
              updatedStocks.push({ id: prodId, stock: current.stock });
            }
          }
        }

        sqliteDb.exec('COMMIT;');

        // 3. Broadcast Real-time Event ke seluruh kasir yang terhubung
        broadcastSseEvent('transaction_created', {
          transaction: {
            id: trxId,
            receipt_number: trx.receipt_number || `NOTA-${Date.now().toString().slice(-6)}`,
            cashier_id: trx.cashier_id || 'KASIR-01',
            cashier_name: trx.cashier_name || 'Kasir Toko',
            terminal_id: terminalId,
            subtotal: Number(trx.subtotal) || 0,
            discount_amount: Number(trx.discount_amount) || 0,
            tax_amount: Number(trx.tax_amount) || 0,
            grand_total: Number(trx.grand_total) || 0,
            payment_method: trx.payment_method || 'CASH',
            cash_given: Number(trx.cash_given) || Number(trx.grand_total) || 0,
            change_returned: Number(trx.change_returned) || 0,
            customer_name: trx.customer_name,
            due_date: trx.due_date,
            notes: trx.notes,
            items: trx.items,
            created_at: createdAt,
            synced: true
          },
          transaction_id: trxId,
          receipt_number: trx.receipt_number,
          terminal_id: terminalId,
          cashier_name: trx.cashier_name,
          grand_total: trx.grand_total,
          updated_stocks: updatedStocks
        });

        return sendJson(200, {
          status: 'success',
          message: 'Transaksi berhasil disimpan ke database terpusat',
          transaction_id: trxId,
          updated_stocks: updatedStocks
        });
      } catch (err) {
        try { sqliteDb.exec('ROLLBACK;'); } catch {}
        console.error('[LAN Server] Gagal memproses transaksi:', err);
        return sendJson(500, { error: 'Gagal memproses transaksi di server: ' + err.message });
      }
    });
  }

  // 6. Mengambil Riwayat Transaksi Terpusat
  if (pathname === '/api/lan/transactions' && req.method === 'GET') {
    const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
    const transactions = sqliteDb.prepare(`
      SELECT * FROM transactions 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);

    // Parse items_json
    const parsed = transactions.map(t => ({
      ...t,
      items: t.items_json ? JSON.parse(t.items_json) : []
    }));

    return sendJson(200, {
      status: 'success',
      count: parsed.length,
      data: parsed
    });
  }

  // 6.b Hapus Transaksi Terpusat oleh Admin & Kembalikan Stok Produk
  if (pathname === '/api/lan/transactions/delete' && req.method === 'POST') {
    return readJsonBody((payload) => {
      const trxId = payload.transaction_id || payload.id;
      if (!trxId) {
        return sendJson(400, { error: 'ID Transaksi wajib diisi' });
      }

      sqliteDb.exec('BEGIN TRANSACTION;');
      try {
        const trx = sqliteDb.prepare('SELECT * FROM transactions WHERE id = ?').get(trxId);
        const updatedStocks = [];

        if (trx && trx.items_json) {
          try {
            const items = JSON.parse(trx.items_json);
            const updateStockStmt = sqliteDb.prepare(`
              UPDATE products 
              SET stock = stock + ?, updated_at = ?
              WHERE id = ?
            `);
            const getStockStmt = sqliteDb.prepare('SELECT id, stock FROM products WHERE id = ?');
            const now = new Date().toISOString();

            for (const item of items) {
              const prodId = item.product_id || item.id;
              const qty = Number(item.qty) || 0;
              if (prodId && qty > 0) {
                updateStockStmt.run(qty, now, prodId);
                const current = getStockStmt.get(prodId);
                if (current) {
                  updatedStocks.push({ id: prodId, stock: current.stock });
                }
              }
            }
          } catch {}
        }

        sqliteDb.prepare('DELETE FROM transactions WHERE id = ?').run(trxId);
        sqliteDb.exec('COMMIT;');

        // Broadcast Real-time Event ke seluruh kasir yang terhubung
        broadcastSseEvent('transaction_deleted', {
          transaction_id: trxId,
          updated_stocks: updatedStocks
        });
        if (updatedStocks.length > 0) {
          broadcastSseEvent('stock_updated', updatedStocks);
        }

        return sendJson(200, {
          status: 'success',
          message: 'Transaksi berhasil dihapus dari server pusat',
          transaction_id: trxId,
          updated_stocks: updatedStocks
        });
      } catch (err) {
        try { sqliteDb.exec('ROLLBACK;'); } catch {}
        return sendJson(500, { error: 'Gagal menghapus transaksi di server: ' + err.message });
      }
    });
  }

  // 7. Push Batch Transaksi Offline dari Klien yang Baru Saja Reconnect
  if (pathname === '/api/lan/sync/push' && req.method === 'POST') {
    return readJsonBody((payload) => {
      const transactions = payload.transactions || [];
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return sendJson(200, { status: 'success', synced_count: 0 });
      }

      let successCount = 0;
      const syncedIds = [];

      sqliteDb.exec('BEGIN TRANSACTION;');
      try {
        const insertTrx = sqliteDb.prepare(`
          INSERT OR REPLACE INTO transactions (
            id, receipt_number, cashier_id, cashier_name, terminal_id,
            subtotal, discount_amount, tax_amount, grand_total, payment_method,
            cash_given, change_returned, items_json, created_at, synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        const updateStockStmt = sqliteDb.prepare(`
          UPDATE products 
          SET stock = MAX(0, stock - ?), updated_at = ?
          WHERE id = ?
        `);

        for (const trx of transactions) {
          insertTrx.run(
            trx.id,
            trx.receipt_number,
            trx.cashier_id || 'KASIR-01',
            trx.cashier_name || 'Kasir',
            trx.terminal_id || 'KASIR-OFFLINE',
            Number(trx.subtotal) || 0,
            Number(trx.discount_amount) || 0,
            Number(trx.tax_amount) || 0,
            Number(trx.grand_total) || 0,
            trx.payment_method || 'CASH',
            Number(trx.cash_given) || 0,
            Number(trx.change_returned) || 0,
            JSON.stringify(trx.items || []),
            trx.created_at || new Date().toISOString()
          );

          if (Array.isArray(trx.items)) {
            for (const item of trx.items) {
              const prodId = item.product_id || item.id;
              if (prodId) {
                updateStockStmt.run(Number(item.qty) || 1, trx.created_at, prodId);
              }
            }
          }

          syncedIds.push(trx.id);
          successCount++;
        }

        sqliteDb.exec('COMMIT;');
        broadcastSseEvent('batch_sync_completed', { count: successCount });

        return sendJson(200, {
          status: 'success',
          synced_count: successCount,
          synced_ids: syncedIds
        });
      } catch (err) {
        try { sqliteDb.exec('ROLLBACK;'); } catch {}
        return sendJson(500, { error: 'Gagal sync batch: ' + err.message });
      }
    });
  }

  // 8. Ambil Riwayat Pembelian Barang Terpusat
  if (pathname === '/api/lan/purchases' && req.method === 'GET') {
    const purchases = sqliteDb.prepare(`
      SELECT * FROM purchases 
      ORDER BY date DESC, created_at DESC 
      LIMIT 100
    `).all();

    const parsed = purchases.map(p => ({
      ...p,
      items: p.items_json ? JSON.parse(p.items_json) : []
    }));

    return sendJson(200, {
      status: 'success',
      count: parsed.length,
      data: parsed
    });
  }

  // 9. Input Faktur Pembelian Barang (Restock) Terpusat
  if (pathname === '/api/lan/purchases' && req.method === 'POST') {
    return readJsonBody((pur) => {
      if (!pur || !pur.invoice_number) {
        return sendJson(400, { error: 'Data pembelian tidak lengkap' });
      }

      sqliteDb.exec('BEGIN TRANSACTION;');
      try {
        const purId = pur.id || `pur-${Date.now()}`;
        const items = pur.items || [];

        sqliteDb.prepare(`
          INSERT OR REPLACE INTO purchases (
            id, invoice_number, supplier_id, supplier_name, date,
            payment_type, due_date, subtotal, discount, total,
            status, cashier_name, notes, items_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          purId,
          pur.invoice_number,
          pur.supplier_id || '',
          pur.supplier_name || 'Supplier',
          pur.date || new Date().toISOString().split('T')[0],
          pur.payment_type || 'CASH',
          pur.due_date || null,
          Number(pur.subtotal) || Number(pur.total) || 0,
          Number(pur.discount) || 0,
          Number(pur.total) || 0,
          pur.status || 'RECEIVED',
          pur.cashier_name || 'Admin',
          pur.notes || '',
          JSON.stringify(items),
          pur.created_at || new Date().toISOString()
        );

        // Tambah stok barang di server
        const updatedStocks = [];
        const updateStockStmt = sqliteDb.prepare(`
          UPDATE products 
          SET stock = stock + ?, updated_at = ?
          WHERE id = ?
        `);
        const getStockStmt = sqliteDb.prepare(`SELECT id, stock FROM products WHERE id = ?`);

        for (const it of items) {
          const prodId = it.product_id || it.id;
          const qty = Number(it.qty) || 0;
          if (prodId && qty > 0) {
            updateStockStmt.run(qty, new Date().toISOString(), prodId);
            const current = getStockStmt.get(prodId);
            if (current) {
              updatedStocks.push({ id: current.id, stock: current.stock });
            }
          }
        }

        sqliteDb.exec('COMMIT;');

        // Broadcast event ke seluruh kasir agar stok langsung bertambah
        broadcastSseEvent('purchase_created', {
          purchase_id: purId,
          invoice_number: pur.invoice_number,
          updated_stocks: updatedStocks
        });
        if (updatedStocks.length > 0) {
          broadcastSseEvent('stock_updated', updatedStocks);
        }

        return sendJson(200, {
          status: 'success',
          message: 'Faktur pembelian berhasil disimpan ke server pusat',
          purchase_id: purId,
          updated_stocks: updatedStocks
        });
      } catch (err) {
        try { sqliteDb.exec('ROLLBACK;'); } catch {}
        return sendJson(500, { error: 'Gagal memproses pembelian di server: ' + err.message });
      }
    });
  }

  // 10. Laporan Rekap Penjualan Hari Ini
  if (pathname === '/api/lan/reports/daily' && req.method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const summary = sqliteDb.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(grand_total), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN grand_total ELSE 0 END), 0) as total_cash,
        COALESCE(SUM(CASE WHEN payment_method != 'CASH' THEN grand_total ELSE 0 END), 0) as total_non_cash
      FROM transactions 
      WHERE created_at LIKE ?
    `).get(`${today}%`);

    const perTerminal = sqliteDb.prepare(`
      SELECT 
        terminal_id, 
        COUNT(*) as order_count, 
        COALESCE(SUM(grand_total), 0) as revenue 
      FROM transactions 
      WHERE created_at LIKE ? 
      GROUP BY terminal_id
    `).all(`${today}%`);

    return sendJson(200, {
      status: 'success',
      date: today,
      summary,
      per_terminal: perTerminal
    });
  }

  // 9. Status Cloudflare Tunnel (Akses Online Luar Rumah)
  if (pathname === '/api/lan/tunnel' && req.method === 'GET') {
    return sendJson(200, {
      status: 'success',
      tunnel: getTunnelInfo()
    });
  }

  // 10. Mulai Cloudflare Tunnel
  if (pathname === '/api/lan/tunnel/start' && req.method === 'POST') {
    const resStart = startCloudflareTunnel();
    return sendJson(200, {
      status: 'success',
      message: 'Cloudflare Tunnel sedang menghubungkan...',
      tunnel: getTunnelInfo()
    });
  }

  // 11. Hentikan Cloudflare Tunnel
  if (pathname === '/api/lan/tunnel/stop' && req.method === 'POST') {
    stopCloudflareTunnel();
    return sendJson(200, {
      status: 'success',
      message: 'Cloudflare Tunnel dimatikan',
      tunnel: getTunnelInfo()
    });
  }

  // ================= STATIC FILE SERVING (WEB CLIENT SPA) =================
  if (!currentDistPath || !fs.existsSync(currentDistPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Static dist path not found on server');
    return;
  }

  let sanitizedPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(currentDistPath, sanitizedPath === '/' ? 'index.html' : sanitizedPath);

  // Jika file tidak ada dan path bukan file ber-ekstensi, fallback ke index.html (SPA)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallbackPath = path.join(currentDistPath, 'index.html');
    if (fs.existsSync(fallbackPath)) {
      filePath = fallbackPath;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
  }

  const mimeMap = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm'
  };

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeMap[ext] || 'application/octet-stream';

  try {
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    stream.pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error: ' + err.message);
  }
}

/**
 * Menjalankan Server LAN
 */
function startLanServer(options = {}) {
  if (serverInstance) {
    return {
      success: true,
      alreadyRunning: true,
      port: currentPort,
      ips: getLanIpAddresses()
    };
  }

  currentPort = options.port || 5858;
  currentDistPath = options.distPath || path.join(__dirname, '../dist');
  currentDataDir = options.dataDir || path.join(os.homedir(), '.config', 'ketoko-pos');

  try {
    initCentralDatabase(currentDataDir);

    serverInstance = http.createServer(handleHttpRequest);

    // Keep-alive heartbeat interval untuk SSE
    const heartbeatTimer = setInterval(() => {
      broadcastSseEvent('ping', { time: Date.now() });
    }, 20000);

    serverInstance.on('close', () => {
      clearInterval(heartbeatTimer);
    });

    serverInstance.listen(currentPort, '0.0.0.0', () => {
      console.log(`[LAN Server] Berjalan di port ${currentPort} (0.0.0.0)`);
      const ips = getLanIpAddresses();
      console.log('[LAN Server] Alamat yang dapat diakses oleh kasir lain:');
      ips.forEach(ip => console.log(`  -> ${ip.iface}: ${ip.url}`));
    });

    return {
      success: true,
      port: currentPort,
      ips: getLanIpAddresses()
    };
  } catch (err) {
    console.error('[LAN Server] Gagal menjalankan server:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Menghentikan Server LAN
 */
function stopLanServer() {
  if (!serverInstance) {
    return { success: true, notRunning: true };
  }

  try {
    // Tutup koneksi SSE
    for (const client of sseClients) {
      try {
        client.end();
      } catch {}
    }
    sseClients = [];

    serverInstance.close();
    serverInstance = null;
    console.log('[LAN Server] Server LAN dihentikan.');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Cek status server
 */
function getLanServerStatus() {
  return {
    running: !!serverInstance,
    port: currentPort,
    ips: getLanIpAddresses(),
    connectedClients: sseClients.length,
    tunnel: getTunnelInfo()
  };
}

module.exports = {
  startLanServer,
  stopLanServer,
  getLanServerStatus,
  getLanIpAddresses,
  startCloudflareTunnel,
  stopCloudflareTunnel,
  getTunnelInfo
};

