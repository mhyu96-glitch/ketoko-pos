import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Helper Login Admin
async function loginAdmin(app: any, screen: any) {
  await app.open('/');
  await screen.getByRole('button', /ADMIN suciawati Ramadhani/).click();
  await screen.getByLabel('Kata Sandi (Password)').fill('admin123');
  await screen.getByRole('button', 'Masuk Aplikasi').click();
  await expect(screen.getByText('suciawati Ramadhani')).toBeVisible();
}

// Helper Login Kasir
async function loginKasir(app: any, screen: any) {
  await app.open('/');
  await screen.getByRole('button', /KASIR Noor Afifah/).click();
  await screen.getByLabel('Kata Sandi (Password)').fill('kasir123');
  await screen.getByRole('button', 'Masuk Aplikasi').click();
  await expect(screen.getByText('Noor Afifah')).toBeVisible();
}

test('01. Memuat halaman login Ketoko POS', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByRole('heading', 'KetokoPOS')).toBeVisible();
  await expect(screen.getByRole('button', 'Masuk Aplikasi')).toBeVisible();
});

test('02. Verifikasi tombol pilihan akun kasir & admin', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByRole('button', /KASIR Noor Afifah/)).toBeVisible();
  await expect(screen.getByRole('button', /ADMIN suciawati Ramadhani/)).toBeVisible();
});

test('03. Alur Login Kasir (Noor Afifah) dan masuk ke POS', async ({ app, screen }) => {
  await loginKasir(app, screen);
  await expect(screen.getByText(/KASIR|CASHIER/)).toBeVisible();
});

test('04. Alur Login Admin (suciawati Ramadhani) dan akses menu lengkap', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  await expect(screen.getByRole('button', 'Dashboard')).toBeVisible();
  await expect(screen.getByRole('button', 'Master Data')).toBeVisible();
  await expect(screen.getByRole('button', 'Persediaan')).toBeVisible();
  await expect(screen.getByRole('button', 'Laporan')).toBeVisible();
  await expect(screen.getByRole('button', 'Pengaturan')).toBeVisible();
});

test('05. Alur Login Superadmin / Vendor Hub', async ({ app, screen }) => {
  await app.open('/');
  await screen.getByLabel('Username').fill('superadmin');
  await screen.getByLabel('Kata Sandi (Password)').fill('5858');
  await screen.getByRole('button', 'Masuk Aplikasi').click();
  await expect(screen.getByText(/MASTER SUPERADMIN/)).toBeVisible();
  await expect(screen.getByRole('heading', /Ketoko POS/)).toBeVisible();
});

test('06. Navigasi Dashboard & Verifikasi KPI Ringkasan Omset', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  await screen.getByRole('button', 'Dashboard').click();
  await expect(screen.getByText('Total Omset Penjualan')).toBeVisible();
  await expect(screen.getByRole('button', 'Buka Kasir POS')).toBeVisible();
  await screen.getByRole('button', 'Buka Kasir POS').click();
});

test('07. Navigasi Master Data - Daftar Item & Harga Produk', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  await screen.getByRole('button', 'Master Data').click();
  await screen.getByRole('button', /Daftar Item & Harga/).click();
  await expect(screen.getByText(/Master Data : Daftar Item & Harga Barang/)).toBeVisible();
});

test('08. Navigasi Persediaan - Manajemen Stok & Lokasi Rak', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  await screen.getByRole('button', 'Persediaan').click();
  await screen.getByRole('button', /Daftar Stok Produk/).click();
  await expect(screen.getByText(/Manajemen Persediaan & Kartu Stok/)).toBeVisible();
});

test('09. Kasir POS - Pencarian Produk & Masuk ke Keranjang Belanja', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  // Cari produk sparepart DENSO
  await screen.getByPlaceholder('Cari nama barang / barcode...').fill('DENSO');
  // Pilih produk dari saran hasil pencarian
  await screen.getByRole('heading', /DENSO/).first().click();
  // Verifikasi produk masuk ke keranjang kasir
  await expect(screen.getByText(/Total Tagihan Pembayaran/)).toBeVisible();
  await expect(screen.getByRole('button', /PROSES BAYAR & CETAK/)).toBeVisible();
});

test('10. Kasir POS - Proses Pembayaran Langsung & Struk Nota', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  // Tambah produk ke keranjang
  await screen.getByPlaceholder('Cari nama barang / barcode...').fill('DENSO');
  await screen.getByRole('heading', /DENSO/).first().click();
  // Klik tombol bayar
  await screen.getByRole('button', /PROSES BAYAR & CETAK/).click();
  // Verifikasi struk pembelian terbuka
  await expect(screen.getByRole('button', /Transaksi Baru/)).toBeVisible();
  // Tutup struk untuk mulai transaksi baru
  await screen.getByRole('button', /Transaksi Baru/).click();
  // Keranjang kembali kosong
  await expect(screen.getByText(/Nota Kasir Kosong/)).toBeVisible();
});

test('11. Navigasi Laporan - Modal Riwayat Transaksi Harian Kasir', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  await screen.getByRole('button', 'Penjualan').click();
  await screen.getByRole('button', /Riwayat Transaksi & Struk/).click();
  await expect(screen.getByText('Laporan Transaksi Harian Kasir')).toBeVisible();
});

test('12. Navigasi Laporan - Pusat Laporan & Analitik Retail', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  await screen.getByRole('button', 'Laporan').click();
  await screen.getByRole('button', /Pusat Laporan Lengkap/).click();
  await expect(screen.getByText('Pusat Laporan & Analitik Retail')).toBeVisible();
  await expect(screen.getByRole('button', /Export PDF/)).toBeVisible();
});

test('13. Navigasi Pengaturan - Pusat Pengaturan Sistem & Toko', async ({ app, screen }) => {
  await loginAdmin(app, screen);
  await screen.getByRole('button', 'Pengaturan').click();
  await screen.getByRole('button', /Data Toko & Input Logo/).click();
  await expect(screen.getByText('Pusat Pengaturan Sistem & Toko')).toBeVisible();
  await expect(screen.getByRole('button', /Data Toko & Logo/)).toBeVisible();
});

test('14. Superadmin membuat toko baru langsung menghasilkan database kosong (0 produk, kasir bersih)', async ({ app, screen }) => {
  await app.open('/');
  await screen.getByLabel('Username').fill('superadmin');
  await screen.getByLabel('Kata Sandi (Password)').fill('5858');
  await screen.getByRole('button', 'Masuk Aplikasi').click();
  await expect(screen.getByText(/MASTER SUPERADMIN/)).toBeVisible();

  // Buka modal buat toko baru
  await screen.getByRole('button', /Daftarkan Klien \/ Toko Baru/).click();
  await expect(screen.getByText(/Database Toko Bersih Otomatis/)).toBeVisible();

  // Isi data toko baru
  await screen.getByPlaceholder('Contoh: Toko Berkah Abadi').fill('Toko Berkah Mandiri');
  await screen.getByPlaceholder('Contoh: Haji Ahmad').fill('Haji Rahmat');

  // Submit tombol buat toko
  await screen.getByRole('button', /Buat Toko Baru \(Data Kosong\)/).click();

  // Verifikasi langsung masuk ke kasir POS dengan mode inspeksi toko baru
  await expect(screen.getByText(/Toko Berkah Mandiri/).first()).toBeVisible();
  // Verifikasi state database kosong
  await expect(screen.getByText(/Toko Baru Siap Digunakan!/)).toBeVisible();
  await expect(screen.getByText(/Database toko masih kosong \(0 Produk\)/)).toBeVisible();
});
