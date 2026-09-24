const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Baca dari .env atau environment variables
const envPath = path.join(__dirname, '..', '.env');
let supabaseUrl = process.env.VITE_SUPABASE_URL || '';
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY harus diset di file .env!');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🚀 Memulai Sinkronisasi Master Produk ke Supabase Cloud...');
  console.log(`🔗 Target URL: ${supabaseUrl}`);

  const productsPath = path.join(__dirname, '..', 'public', 'data', 'products.json');
  if (!fs.existsSync(productsPath)) {
    console.error('❌ File products.json tidak ditemukan!');
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  const total = products.length;
  console.log(`📦 Ditemukan ${total.toLocaleString('id-ID')} master barang.`);

  const batchSize = 500;
  let uploaded = 0;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = products.slice(i, i + batchSize).map(p => ({
      id: p.id,
      barcode: p.barcode || '',
      name: p.name,
      category: p.category || 'Kebutuhan Umum',
      buy_price: p.buy_price || 0,
      retail_price: p.retail_price || 0,
      wholesale_price: p.wholesale_price || 0,
      stock: Math.min(2147483647, Math.max(-2147483648, Number(p.stock) || 0)),
      unit: p.unit || 'Pcs',
      rack_location: p.rack_location || 'Rak Utama'
    }));

    const { error } = await client.from('products').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`⚠️ Error pada batch ${i} - ${i + chunk.length}:`, error.message);
    } else {
      uploaded += chunk.length;
      const pct = Math.round((uploaded / total) * 100);
      process.stdout.write(`\r[Supabase] Terunggah: ${uploaded.toLocaleString('id-ID')} / ${total.toLocaleString('id-ID')} (${pct}%)`);
    }
  }

  console.log('\n✅ Sinkronisasi Master Barang Selesai!');

  // Seed default store settings
  await client.from('store_settings').upsert({
    id: 'default',
    name: 'CV. Tumbuh Makmur Air Conindo',
    branch_name: 'Cabang Samarinda (BR-01)',
    tagline: 'Solusi Pendingin & Tata Udara Terpercaya',
    address: 'Samarinda, Kalimantan Timur',
    phone: '0812-3456-7890',
    updated_at: new Date().toISOString()
  });

  console.log('✅ Profil Toko Terkonfigurasi di Supabase Cloud.');
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
