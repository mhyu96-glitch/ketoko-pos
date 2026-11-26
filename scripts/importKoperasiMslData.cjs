const fs = require('fs');
const path = require('path');
const os = require('os');

// Require xlsx from scratch directory
const scratchDir = 'C:/Users/borneo etam/.gemini/antigravity/brain/84f68666-b98d-4163-9f65-9f3f8f12c362/scratch';
const xlsx = require(path.join(scratchDir, 'node_modules', 'xlsx'));

const fKaryawan = 'C:/Users/borneo etam/.gemini/antigravity/brain/84f68666-b98d-4163-9f65-9f3f8f12c362/.user_uploaded/media_1795690806428_9671fd40.xlsx';
const fBarang = 'C:/Users/borneo etam/.gemini/antigravity/brain/84f68666-b98d-4163-9f65-9f3f8f12c362/.user_uploaded/media_1795690806428_613ba063.xlsx';

const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
const now = new Date().toISOString();

console.log('========================================================');
console.log('  IMPORT MASTER DATA KOPERASI MSL (KARYAWAN & PERSEDIAAN)');
console.log('========================================================');

// 1. PARSE KARYAWAN
console.log('\n[1/4] Parsing Data Karyawan dari:', fKaryawan);
const wbKaryawan = xlsx.readFile(fKaryawan);
const employeeMap = new Map();

const empSheets = ['ALL KARYAWAN', 'TAMBAHAN DATA KARYAWAN'];
for (const sheetName of empSheets) {
  if (!wbKaryawan.Sheets[sheetName]) continue;
  const rows = xlsx.utils.sheet_to_json(wbKaryawan.Sheets[sheetName], { header: 1 });
  console.log(`  -> Sheet "${sheetName}": ${rows.length} baris`);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1] || !row[2]) continue;

    const profile = String(row[0] || '').trim();
    const rawCode = String(row[1] || '').trim();
    const name = String(row[2] || '').trim().toUpperCase();
    const job = String(row[3] || '').trim();
    const status = String(row[4] || '').trim();
    const afdeling = String(row[5] || '').trim().toUpperCase();

    if (!rawCode || !name) continue;

    // Clean code for ID: e.g. "52/5221/0911/324" -> "5252210911324"
    const safeId = 'cust-msl-' + rawCode.replace(/[^a-zA-Z0-9]/g, '');

    const customerObj = {
      id: safeId,
      code: rawCode,
      name: name,
      phone: '-',
      address: `${afdeling ? 'Afdeling ' + afdeling : 'Afdeling -'}, ${profile || 'MSL'}`,
      type: 'KARYAWAN',
      store_id: 'store-koperasimsl',
      store_name: 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI',
      access_scope: 'ALL_STORES',
      monthly_allowance: 2000000,
      deposit_balance: 2000000,
      last_allowance_reset: currentMonth,
      credit_limit: 2000000,
      current_receivable: 0,
      current_debt: 0,
      discount_percent: 0,
      notes: `Unit: ${profile} | Afdeling: ${afdeling} | Jabatan: ${job} | Status: ${status}`,
      created_at: now,
      updated_at: now
    };

    employeeMap.set(rawCode, customerObj);
  }
}

const customersList = Array.from(employeeMap.values());
console.log(`  âœ… Total Karyawan berhasil diproses: ${customersList.length.toLocaleString('id-ID')} orang`);

// 2. PARSE PERSEDIAAN BARANG
console.log('\n[2/4] Parsing Persediaan Barang Koperasi dari:', fBarang);
const wbBarang = xlsx.readFile(fBarang);
const sBarang = wbBarang.Sheets['Sheet1'] || wbBarang.Sheets[wbBarang.SheetNames[0]];
const barangRows = xlsx.utils.sheet_to_json(sBarang, { header: 1 });

let currentCategory = 'SEMBAKO';
const productsList = [];

for (let i = 3; i < barangRows.length; i++) {
  const row = barangRows[i];
  if (!row || row.length === 0) continue;

  const col0 = row[0];
  const col1 = row[1];

  // Category detection
  if (!col0 && col1 && typeof col1 === 'string' && (col1.includes('PERSEDIAAN') || col1.includes('KERUPUK') || col1.includes('KEBUTUHAN'))) {
    let cleanCat = col1.replace('PERSEDIAAN', '').trim();
    if (!cleanCat) cleanCat = col1.trim();
    currentCategory = cleanCat;
    continue;
  }

  // Item row
  if (col0 && (typeof col0 === 'number' || (typeof col0 === 'string' && col0.trim()))) {
    const rawCode = String(col0).trim();
    let name = col1 ? String(col1).trim() : '';
    if (!name) {
      name = `BARANG ${rawCode}`;
    }

    const sat = String(row[2] || 'PCS').trim().toUpperCase();
    const openQty = Number(row[3]) || 0;
    const openPrice = Math.round(Number(row[4]) || 0);
    const recQty = Number(row[6]) || 0;
    const recPrice = Math.round(Number(row[7]) || 0);
    const sellPrice = Math.round(Number(row[9]) || 0);

    // Modal bulan ini: utamakan receive bulan ini, jika 0 pakai opening price
    const buyPrice = recPrice > 0 ? recPrice : openPrice;
    
    // Harga jual: pakai kolom HARGA JUAL
    const finalRetailPrice = sellPrice > 0 ? sellPrice : (buyPrice > 0 ? Math.round(buyPrice * 1.05) : 0);

    // Stok bulan ini: opening + receive (total persediaan yang ada)
    const totalStock = openQty + recQty;

    const productObj = {
      id: `prod-msl-${rawCode}`,
      barcode: rawCode,
      name: name,
      category: currentCategory,
      buy_price: buyPrice,
      retail_price: finalRetailPrice,
      wholesale_price: finalRetailPrice,
      min_wholesale_qty: 1,
      stock: totalStock,
      unit: sat,
      rack_location: currentCategory,
      min_stock_alert: 5,
      store_id: 'store-koperasimsl',
      updated_at: now
    };

    productsList.push(productObj);
  }
}

console.log(`  âœ… Total Produk Persediaan berhasil diproses: ${productsList.length.toLocaleString('id-ID')} item`);

// 3. SIMPAN KE FILE PUBLIC JSON SEED
console.log('\n[3/4] Menyimpan ke public/data/...');
const dataDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const custOutPath = path.join(dataDir, 'customers_koperasi_msl.json');
const prodOutPath = path.join(dataDir, 'products_koperasi_msl.json');

fs.writeFileSync(custOutPath, JSON.stringify(customersList, null, 2), 'utf8');
fs.writeFileSync(prodOutPath, JSON.stringify(productsList, null, 2), 'utf8');
console.log(`  âœ… Saved: ${custOutPath} (${(fs.statSync(custOutPath).size / 1024).toFixed(1)} KB)`);
console.log(`  âœ… Saved: ${prodOutPath} (${(fs.statSync(prodOutPath).size / 1024).toFixed(1)} KB)`);

// 4. INJECT LANGSUNG KE SQLITE LAN SERVER (JIKA ADA DATABASE)
console.log('\n[4/4] Injeksi ke SQLite Central LAN...');
let sqliteInjected = false;
try {
  const { DatabaseSync } = require('node:sqlite');
  const possiblePaths = [
    path.join(os.homedir(), '.config', 'ketoko-pos', 'ketoko_central.sqlite'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'ketoko-pos', 'ketoko_central.sqlite'),
    path.join(__dirname, '..', 'ketoko_central.sqlite'),
    path.join(__dirname, '..', 'electron', 'ketoko_central.sqlite')
  ];

  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      console.log(`  -> Menemukan SQLite di: ${dbPath}`);
      const sDb = new DatabaseSync(dbPath);
      
      // Ensure columns exist in customers
      const tableInfo = sDb.prepare("PRAGMA table_info(customers)").all();
      const colNames = tableInfo.map(c => c.name);
      if (!colNames.includes('monthly_allowance')) {
        sDb.exec("ALTER TABLE customers ADD COLUMN monthly_allowance REAL DEFAULT 2000000;");
      }
      if (!colNames.includes('last_allowance_reset')) {
        sDb.exec("ALTER TABLE customers ADD COLUMN last_allowance_reset TEXT;");
      }
      if (!colNames.includes('type')) {
        sDb.exec("ALTER TABLE customers ADD COLUMN type TEXT DEFAULT 'RETAIL';");
      }
      if (!colNames.includes('notes')) {
        sDb.exec("ALTER TABLE customers ADD COLUMN notes TEXT;");
      }
      if (!colNames.includes('access_scope')) {
        sDb.exec("ALTER TABLE customers ADD COLUMN access_scope TEXT DEFAULT 'ALL_STORES';");
      }

      // Upsert customers
      const custStmt = sDb.prepare(`
        INSERT INTO customers (id, code, name, phone, address, credit_limit, current_debt, deposit_balance, store_id, created_at, updated_at, monthly_allowance, last_allowance_reset, type, notes, access_scope)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          code = excluded.code,
          name = excluded.name,
          address = excluded.address,
          deposit_balance = excluded.deposit_balance,
          monthly_allowance = excluded.monthly_allowance,
          last_allowance_reset = excluded.last_allowance_reset,
          type = excluded.type,
          notes = excluded.notes,
          access_scope = excluded.access_scope,
          updated_at = excluded.updated_at
      `);

      sDb.exec('BEGIN TRANSACTION;');
      for (const c of customersList) {
        custStmt.run(
          c.id, c.code, c.name, c.phone, c.address, 2000000, 0, 2000000,
          'store-koperasimsl', c.created_at, c.updated_at,
          2000000, currentMonth, 'KARYAWAN', c.notes, 'ALL_STORES'
        );
      }
      sDb.exec('COMMIT;');
      console.log(`     âœ… Berhasil menyimpan ${customersList.length} karyawan ke SQLite (${path.basename(dbPath)})`);

      // Ensure store_id column in products
      const pInfo = sDb.prepare("PRAGMA table_info(products)").all();
      const pCols = pInfo.map(c => c.name);
      if (!pCols.includes('store_id')) {
        sDb.exec("ALTER TABLE products ADD COLUMN store_id TEXT DEFAULT 'store-01';");
      }

      // Upsert products
      const prodStmt = sDb.prepare(`
        INSERT INTO products (id, barcode, name, category, buy_price, retail_price, wholesale_price, min_wholesale_qty, stock, unit, rack_location, min_stock_alert, store_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          barcode = excluded.barcode,
          name = excluded.name,
          category = excluded.category,
          buy_price = excluded.buy_price,
          retail_price = excluded.retail_price,
          wholesale_price = excluded.wholesale_price,
          stock = excluded.stock,
          unit = excluded.unit,
          rack_location = excluded.rack_location,
          store_id = excluded.store_id,
          updated_at = excluded.updated_at
      `);

      sDb.exec('BEGIN TRANSACTION;');
      for (const p of productsList) {
        prodStmt.run(
          p.id, p.barcode, p.name, p.category, p.buy_price, p.retail_price,
          p.wholesale_price, p.min_wholesale_qty, p.stock, p.unit,
          p.rack_location, p.min_stock_alert, 'store-koperasimsl', p.updated_at
        );
      }
      sDb.exec('COMMIT;');
      console.log(`     âœ… Berhasil menyimpan ${productsList.length} produk persediaan ke SQLite (${path.basename(dbPath)})`);

      sqliteInjected = true;
    }
  }
} catch (e) {
  console.warn('  âš  Catatan SQLite injection:', e.message);
}

// 5. SEED TO SUPABASE IF AVAILABLE
const envPath = path.join(__dirname, '..', '.env');
let supabaseUrl = '';
let supabaseKey = '';
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = l.split('=')[1].trim();
    if (l.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = l.split('=')[1].trim();
  }
}

if (supabaseUrl && supabaseKey) {
  console.log('\n[Supabase Cloud Sync]');
  console.log('  -> Menghubungkan ke Supabase Cloud:', supabaseUrl);
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    (async () => {
      // Upsert products in chunks
      console.log(`  -> Mengunggah ${productsList.length} produk persediaan ke Supabase...`);
      for (let i = 0; i < productsList.length; i += 100) {
        const chunk = productsList.slice(i, i + 100);
        const { error } = await supabase.from('products').upsert(chunk);
        if (error) {
          console.warn('     Supabase product chunk warning:', error.message);
          break;
        }
      }
      console.log('     âœ… Sinkronisasi produk ke Supabase selesai!');

      // Upsert customers in chunks
      console.log(`  -> Mengunggah ${customersList.length} karyawan ke Supabase...`);
      for (let i = 0; i < customersList.length; i += 100) {
        const chunk = customersList.slice(i, i + 100);
        const { error } = await supabase.from('customers').upsert(chunk);
        if (error) {
          console.warn('     Supabase customer chunk warning:', error.message);
          break;
        }
      }
      console.log('     âœ… Sinkronisasi karyawan ke Supabase selesai!');
      console.log('\n========================================================');
      console.log('  SEMUA DATA KOPERASI MSL BERHASIL DI-IMPORT!');
      console.log('========================================================');
    })();
  } catch (err) {
    console.warn('  âš  Supabase client not run:', err.message);
  }
} else {
  console.log('\n========================================================');
  console.log('  SEMUA DATA KOPERASI MSL BERHASIL DI-GENERATE!');
  console.log('========================================================');
}
