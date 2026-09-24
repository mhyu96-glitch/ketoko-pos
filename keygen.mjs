#!/usr/bin/env node

/**
 * ============================================================================
 * KETOKO POS — OFFICIAL LICENSE KEY GENERATOR (KHUSUS PENJUAL / DEVELOPER)
 * ============================================================================
 * Gunakan skrip ini untuk membuat Serial Key bagi klien/pembeli aplikasi.
 * 
 * CARA PAKAI:
 *   node keygen.mjs <KODE_MESIN> [NAMA_TOKO]
 * 
 * CONTOH:
 *   node keygen.mjs KPOS-7A89-B2E4-91F0 "Toko Berkah Samarinda"
 * ============================================================================
 */

const MASTER_SALT = 'KETOKO_POS_MASTER_SECURITY_SALT_2026_SAMARINDA';

function hashString(str) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const hex1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return hex1 + hex2;
}

function generateLicenseKey(machineId, storeName = '') {
  const cleanMachineId = machineId.trim().toUpperCase();
  const cleanStore = storeName.trim().toLowerCase();
  const rawData = `${cleanMachineId}::${cleanStore}::${MASTER_SALT}`;
  const fullHash = hashString(rawData);

  const p1 = fullHash.substring(0, 4);
  const p2 = fullHash.substring(4, 8);
  const p3 = fullHash.substring(8, 12);
  const p4 = fullHash.substring(12, 16);

  return `ACT-${p1}-${p2}-${p3}-${p4}`;
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║             KETOKO POS - DEVELOPER LICENSE KEY GENERATOR             ║
╚══════════════════════════════════════════════════════════════════════╝

Cara Penggunaan:
  node keygen.mjs <KODE_MESIN_PEMBELI> "[NAMA_TOKO]"

Contoh:
  node keygen.mjs KPOS-7A89-B2E4-91F0 "Toko Berkah Samarinda"
  `);
  process.exit(1);
}

const machineId = args[0];
const storeName = args[1] || '';
const serialKey = generateLicenseKey(machineId, storeName);

console.log('\n==========================================================');
console.log('           HASIL GENERATE LISENSI KETOKO POS              ');
console.log('==========================================================');
console.log(`📌 ID Mesin / Device ID : ${machineId.toUpperCase()}`);
if (storeName) {
  console.log(`🏪 Nama Toko Terdaftar  : ${storeName}`);
}
console.log(`🔑 SERIAL KEY AKTIVASI  : ${serialKey}`);
console.log('==========================================================\n');
console.log(`Kirimkan Serial Key di atas kepada pembeli untuk aktivasi.`);
console.log('');
