const path = require('node:path');
const os = require('node:os');
const lanServer = require('./electron/lanServer.cjs');

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5858;
const distPath = path.join(__dirname, 'dist');
const dataDir = path.join(os.homedir(), '.config', 'ketoko-pos');

console.log('='.repeat(65));
console.log('  🚀 MENJALANKAN KETOKO POS SERVER (DATABASE TERPUSAT)');
console.log('='.repeat(65));

const res = lanServer.startLanServer({
  port,
  distPath,
  dataDir
});

if (res.success) {
  console.log(`\n✔ Server Aktif di Localhost: http://localhost:${port}`);
  console.log('✔ Alamat Jaringan LAN / Wi-Fi Toko:');
  res.ips.forEach(ip => {
    console.log(`   -> [${ip.iface}]: ${ip.url}`);
  });
  console.log('\nServer siap menerima koneksi kasir dari localhost dan LAN.');

  const enableTunnel = process.argv.includes('--tunnel') || process.env.ENABLE_TUNNEL === 'true';
  if (enableTunnel) {
    console.log('\n[Cloudflare] Memulai Cloudflare Tunnel untuk akses online luar rumah...');
    lanServer.startCloudflareTunnel(port);
  }
} else {
  console.error('❌ Gagal menjalankan server:', res.error);
  process.exit(1);
}

