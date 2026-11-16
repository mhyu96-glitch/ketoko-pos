# PRODUCT REQUIREMENTS DOCUMENT (PRD) & UI/UX DESIGN SPECIFICATION
## Ketoko POS Modern Enterprise Features: Customer Facing Display & Multi-Store Gateway

> **Target Platform**: Desktop POS (Electron Windows/Linux) & Tablet Web Companion (16:9 Landscape / Full HD)  
> **Aesthetic Theme**: Modern Clean White Retail & Warm Coffee Accent (`#0F172A` Slate, `#FFFFFF` White, `#7C4E2F` Coffee, `#059669` Emerald)  
> **Doc Version**: 2.5.0 • Ready for Google Stitch & Development  
> **Author**: Ketoko POS Engineering & Product Design Team  

---

## 📑 DAFTAR ISI
1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Target Personas & User Journeys](#2-target-personas--user-journeys)
3. [Fitur 1: Customer Facing Display (Layar Hadap Pelanggan)](#3-fitur-1-customer-facing-display-layar-hadap-pelanggan)
   - 3.1 Ringkasan Kebutuhan & Cara Kerja
   - 3.2 Arsitektur Sinkronisasi Real-Time (Cross-Tab & LAN Wi-Fi)
   - 3.3 Spesifikasi Detail 5 State Layar
   - 3.4 Wireframe & Skema Layout 65:35
4. [Fitur 2: Multi-Store Gateway & Login Hub (Pilihan Database Toko)](#4-fitur-2-multi-store-gateway--login-hub-pilihan-database-toko)
   - 4.1 Ringkasan Kebutuhan & Masalah yang Diselesaikan
   - 4.2 Arsitektur Isolasi Database Lokal (SQLite & Dexie)
   - 4.3 Spesifikasi Komponen & Alur Buat Toko Baru
   - 4.4 Sistem Login PIN Layar Sentuh (Touch Numpad)
5. [Design System & Tokens untuk Google Stitch](#5-design-system--tokens-untuk-google-stitch)
6. [Prompt Siap Pakai untuk Google Stitch](#6-prompt-siap-pakai-untuk-google-stitch)
7. [Non-Functional Requirements & Security](#7-non-functional-requirements--security)

---

# 1. Executive Summary & Product Vision

Ketoko POS adalah sistem aplikasi kasir dan ERP retail offline-first untuk toko modern (supermarket, minimarket, toko sembako grosir & eceran). Dokumen ini menspesifikasikan dua fitur tingkat enterprise yang meningkatkan efisiensi dan transparansi belanja:

1. **Customer Facing Display (Layar Pelanggan)**:  
   Layar sekunder yang menghadap langsung ke pembeli. Dapat berjalan di monitor kedua kasir (Dual Monitor HDMI/VGA) atau diakses secara fleksibel menggunakan tablet Android/iPad lewat jaringan Wi-Fi lokal toko. Menghilangkan keraguan pelanggan atas harga dan stok, mempercepat pembayaran QRIS, serta menampilkan uang kembalian secara tegas dan akurat.
2. **Multi-Store Gateway & Login Hub (Pilihan Database Toko)**:  
   Satu aplikasi dapat mengelola beberapa cabang usaha atau unit bisnis yang berbeda (misal: Toko Sembako Utama, Cabang Balikpapan, Apotek/Toko Baju) dalam satu laptop/PC kasir tanpa risiko data stok, transaksi nota, dan riwayat utang piutang bercampur aduk.

---

# 2. Target Personas & User Journeys

### 1. Pelanggan Toko (Customer)
* **Goal**: Melihat harga barang saat di-scan secara jujur dan transparan, mengetahui total diskon member, melakukan pembayaran QRIS dengan cepat dari HP, serta memastikan uang kembalian tunai dihitung dengan tepat.
* **Pain Point**: Sering tidak tahu apakah kasir salah input harga atau salah hitung kembalian, sulit melihat layar kasir yang menghadap ke dalam.

### 2. Kasir Toko (Cashier)
* **Goal**: Melayani antrean dengan kecepatan tinggi tanpa perlu mengulang-ulang menyebutkan nominal tagihan atau mengarahkan struk manual ke pembeli.
* **Pain Point**: Pelanggan sering bertanya kembali *"Totalnya berapa tadi mbak?"* atau lambat mengeluarkan aplikasi pembayaran QRIS.

### 3. Pemilik Toko (Business Owner)
* **Goal**: Menampilkan banner promosi toko secara otomatis saat kasir sedang sepi (idle) serta memiliki fleksibilitas membuka banyak toko/cabang dalam 1 komputer kasir.

---

# 3. Fitur 1: Customer Facing Display (Layar Hadap Pelanggan)

## 3.1 Ringkasan Kebutuhan & Cara Kerja
Layar pelanggan beroperasi secara paralel dengan layar kasir utama:
* **Perangkat Keras Fleksibel**:
  * **Opsi A (Monitor Kedua Kabel)**: Menggunakan monitor HDMI/VGA kedua yang dicolokkan ke komputer kasir. Electron membuka jendela sekunder otomatis ke monitor 2.
  * **Opsi B (Tablet / HP Nirkabel Wi-Fi)**: Tablet Android / iPad yang ditaruh di meja kasir cukup membuka browser ke alamat `http://<ip-kasir>:5858/display`.
* **Zero Internet Required (100% Offline)**: Tidak membutuhkan koneksi internet publik.

## 3.2 Arsitektur Sinkronisasi Real-Time
Komunikasi antara kasir utama dan layar pelanggan dirancang menggunakan arsitektur ganda (*dual-engine*):

```
+---------------------------------------------------------------------------------+
|                                KOMPUTER KASIR UTAMA                             |
|                                                                                 |
|  [POS Cashier View] ---> useCart Hook / handleProcessPayment                    |
|          |                                                                      |
|          +---> Engine A: BroadcastChannel('ketoko_customer_display')            |
|          |     (Latency < 2ms, zero overhead, sinkronisasi instan antar-jendela)|
|          |                                                                      |
|          +---> Engine B: Express LAN Server (Port 5858)                         |
|                POST /api/lan/display/event ---> Server-Sent Events (SSE)        |
+-----------------------------------------+---------------------------------------+
                                          |
                      +-------------------+--------------------+
                      |                                        |
                      v                                        v
         [Jendela Monitor 2 Desktop]                [Tablet Wi-Fi Meja Kasir]
             (Electron Window 2)                    (http://192.168.1.x:5858)
```

### Event Payload Specification:
1. `CART_UPDATE`: Dikirim setiap kali barang ditambah, diubah qty, atau dihapus.
   ```json
   {
     "type": "CART_UPDATE",
     "items": [
       { "name": "Minyak Goreng Bimoli 2L", "qty": 2, "price": 38000, "subtotal": 76000, "unit": "Pcs", "code": "89923451" },
       { "name": "Gula Pasir Gulaku 1kg", "qty": 2, "price": 16500, "subtotal": 33000, "unit": "Bks", "code": "89955432" }
     ],
     "customerName": "Bpk. Bambang (Gold Member)",
     "discount": 5000,
     "tax": 0,
     "subtotal": 109000,
     "grandTotal": 104000
   }
   ```
2. `PAYMENT_START`: Dikirim saat kasir menekan tombol bayar / memilih metode bayar.
   ```json
   { "type": "PAYMENT_START", "method": "QRIS", "grandTotal": 104000 }
   ```
3. `TRANSACTION_SUCCESS`: Dikirim saat transaksi kasir berhasil dicetak/disimpan.
   ```json
   { "type": "TRANSACTION_SUCCESS", "invoiceNo": "INV-20261110-0089", "paymentMethod": "CASH", "change": 46000 }
   ```

---

## 3.3 Spesifikasi Detail 5 State Layar Pelanggan

### State 1: STANDBY / IDLE (Katalog Promo & Selamat Datang)
* **Kiri (60% Lebar)**: Showcase Promo Mingguan 4 Kartu:
  * Promo 1: Minyak Bimoli Beli 2 Gratis Gula (Diskon 15%).
  * Promo 2: Kopi Kapal Api Harga Grosir Minimal 5 Bungkus.
  * Promo 3: Beras Premium Raja Lele Double Poin Member.
  * Promo 4: Bayar QRIS Bebas Biaya Admin Semua Bank & E-Wallet.
* **Kanan (40% Lebar)**:
  * Ucapan *"Selamat Datang di Toko Berkah Jaya"*.
  * Informasi pendaftaran member: *"Belum punya member? Daftarkan nomor WhatsApp Anda ke kasir sekarang!"*.
  * Status kasir aktif: Nama kasir yang sedang bertugas.

### State 2: SCANNING / ACTIVE CART (Daftar Belanja Live)
* **Tata Letak 65% : 35%**:
  * **Kolom Kiri (65%)**: Tabel daftar belanjaan supermarket:
    * Kolom: `No` | `Nama Barang / Produk` | `Kuantitas` | `Subtotal`.
    * Barang baru yang baru saja di-scan berkedip halus hijau emerald dengan badge `[ BARU ]`.
    * Bagian bawah tabel: Nama member terdaftar & badge penghematan: `🎉 Hemat Diskon Member: Rp 5.000`.
  * **Kolom Kanan (35%)**: Konsol Pembayaran:
    * Rincian: Subtotal, Potongan Diskon, Pajak PPN 0%.
    * **TOTAL TAGIHAN HERO BANNER**: Huruf tebal 38px, warna kontras tinggi, kalimat terbilang bahasa Indonesia.
    * Panel animasi kasir sedang menghitung belanja.

### State 3: BAYAR QRIS (Dynamic QR Code)
* Banner resmi standar nasional QRIS (Merah `#C72428`).
* Kode QR dinamis tajam di tengah kartu putih.
* Panduan aplikasi pembayaran: BCA Mobile, Livin Mandiri, BRImo, GoPay, OVO, Dana, ShopeePay.
* Nominal transfer otomatis tertera tebal sesuai total belanja.

### State 4: BAYAR TUNAI (Kembalian Uang Tunai)
* Baris Uang Diterima dari Pelanggan: misal `Rp 150.000`.
* **KOTAK KEMBALIAN EMERALD BESAR**:
  * Label: `UANG KEMBALIAN ANDA`
  * Nominal kembalian besar tebal: **`Rp 36.000`** (font size 40px) dengan warna hijau emerald menyala agar terlihat jelas dari kejauhan.
  * Catatan: *"Mohon hitung kembali uang kembalian Anda sebelum beranjak"*.

### State 5: TRANSAKSI SELESAI (Struk Lunas)
* Animasi centang hijau sukses (`✓`).
* Ucapan terima kasih telah berbelanja di nama toko bersangkutan.
* Kartu rincian nota lunas: Nomor Struk, Total Pembayaran, Status Lunas & Kembalian.
* **Timer Auto-Reset**: Hitung mundur 6 detik otomatis kembali ke Layar Standby.

---

## 3.4 Skema Layout Wireframe (Rasio 16:9 Widescreen)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo] TOKO BERKAH JAYA - SAMARINDA KOTA             [● KASIR ONLINE]   12:15:00 WITA • 10 Nov   |
+----------------------------------------------------+----------------------------------------------+
|  DAFTAR BELANJA ANDA (3 Item • 5 Pcs)              |  RINGKASAN PEMBAYARAN                        |
|                                                    |                                              |
|  No | Nama Barang        | Qty      | Subtotal     |  Subtotal:                     Rp 119.000    |
|  ---+--------------------+----------+------------- |  Diskon Member:               -Rp   5.000    |
|  1  | Minyak Bimoli 2L   | 2 Pcs    | Rp  76.000   |  Pajak (PPN 0%):                     Rp 0    |
|  2  | Gula Gulaku 1kg    | 2 Bks    | Rp  33.000   |  +----------------------------------------+  |
|  3  | Kopi Kapal Api     | 1 Bks    | Rp  10.000   |  | TOTAL TAGIHAN             [ PAS ]      |  |
|     | [BARU DITAMBAHKAN] |          |              |  | Rp 114.000                                |  |
|                                                    |  | (Seratus Empat Belas Ribu Rupiah)          |  |
|                                                    |  +----------------------------------------+  |
|                                                    |  KOTAK STATUS PEMBAYARAN:                    |
|                                                    |  [ Mode QRIS / Kotak Kembalian Tunai ]       |
|                                                    |  Uang Diterima: Rp 150.000                   |
|                                                    |  +----------------------------------------+  |
|                                                    |  | UANG KEMBALIAN ANDA                    |  |
|                                                    |  | Rp 36.000                              |  |
|                                                    |  +----------------------------------------+  |
|  ------------------------------------------------- |                                              |
|  👑 Member: Bpk. Bambang   | 🎉 Anda Hemat: Rp 5rb |  Terminal: Kasir 01 • Petugas: Suciawati     |
+----------------------------------------------------+----------------------------------------------+
|  📢 INFO: Buka Setiap Hari Pukul 07.00 - 22.00 WITA • Melayani Grosir & Eceran • Poin Belanja Hemat |
+---------------------------------------------------------------------------------------------------+
```

---

# 4. Fitur 2: Multi-Store Gateway & Login Hub (Pilihan Database Toko)

## 4.1 Ringkasan Kebutuhan & Masalah yang Diselesaikan
* **Problem**: Pelaku usaha UMKM sering memiliki lebih dari satu jenis usaha di lokasi yang sama atau memiliki cabang baru (misal: Ruko Cabang 2, Toko Grosir vs Toko Eceran). Membuka banyak aplikasi berbeda sangat membingungkan.
* **Solution**: Halaman sambutan di awal aplikasi yang menampilkan kartu-kartu toko. Pemilik atau kasir cukup memilih toko yang ingin dibuka, dan sistem secara otomatis memuat database independen untuk toko tersebut.

## 4.2 Arsitektur Isolasi Database Lokal
Setiap toko memiliki lingkungan data yang terisolasi 100%:
1. **SQLite Database Level**:
   * File database dinamai berdasarkan ID toko: `ketoko_store_sembako.sqlite`, `ketoko_store_cabang2.sqlite`.
   * Tidak ada percampuran tabel transaksi, piutang, maupun nomor nota nota.
2. **IndexedDB (Dexie) Level**:
   * Partisi tabel Dexie dengan schema toko atau penyimpanan terpisah ber-prefix `store_id`.
3. **Session Cache**:
   * `localStorage.setItem('ketoko_active_store_id', selectedStoreId);`
   * Saat kasir berganti toko, keranjang aktif (*cart*) di-reset bersih agar tidak ada barang toko A yang terbawa ke toko B.

## 4.3 Spesifikasi Komponen & Alur Buat Toko Baru

### Alur Tambah Database Toko Baru:
1. Klik kartu dashed `[+ Tambah Database Toko Baru]`.
2. Muncul modal form wizard:
   * **Nama Toko / Usaha**: (misal *"Toko Sumber Rezeki"*).
   * **Kode Cabang**: (misal *"BR-03"*).
   * **Kategori Usaha**: Pilihan Sembako, Fashion/Baju, Makanan/Kafe, Elektronik, Apotek.
   * **Opsi Katalog Awal**:
     * `[•] Katalog Bersih Kosong (0 Produk)` -> Siap untuk input baru dari nol.
     * `[ ] Salin Master Daftar Harga dari Toko Utama` -> Membantu jika cabangnya menjual barang yang sama.
3. Sistem membuat database SQLite baru dan menginisialisasi akun kasir standar (`admin`, `kasir`).

## 4.4 Sistem Login PIN Layar Sentuh (Touch Numpad)
Saat kasir memilih toko:
1. Muncul modal overlay dengan pilihan avatar nama kasir (misal: *Suciawati*, *Noor Afifah*, *Admin*).
2. Input PIN 4-6 digit menggunakan numpad layar sentuh besar (`1` s/d `9`, `0`, tombol `Hapus`, `Masuk`).
3. Verifikasi instan secara offline tanpa perlu terhubung ke cloud server.

---

# 5. Design System & Tokens untuk Google Stitch

```yaml
Brand Aesthetic: "Modern Clean White Retail & Warm Roast Coffee"
Design Tokens:
  Background Canvas: "#F1F5F9" # Soft Slate Grey Canvas
  Card Surface White: "#FFFFFF" # Pure Clean Card
  Surface Sub-Panel: "#FAF7F4" # Soft Porcelain Latte
  Primary Roast Coffee: "#7C4E2F" # Warm Dark Roast
  Primary Deep Espresso: "#54341E" # Deep Coffee Accent
  Text Heading Dark: "#0F172A" # Crisp Slate 900
  Text Subtitle Grey: "#64748B" # Slate 500
  Accent Emerald Green: "#059669" # Success / Savings / Cash Change
  Accent Amber Warning: "#D97706" # Promo Tags / Highlights
  Accent QRIS Red: "#C72428" # Official QRIS Brand Red
  Border Subtle: "#E2E8F0" # Clean Divider Border

Typography:
  Body & Headings: "Plus Jakarta Sans, Inter, sans-serif"
  Numbers / Currency / Barcodes: "JetBrains Mono, Roboto Mono, monospace" (Tabular figures)

Elevations & Radius:
  Card Border Radius: "rounded-2xl (16px) for major modules"
  Button Border Radius: "rounded-xl (12px)"
  Badges: "rounded-full"
  Shadows: "shadow-xs border border-slate-200 for crisp daylight visibility"
```

---

# 6. Prompt Siap Pakai untuk Google Stitch

Jika kamu ingin men-generate desain UI ini langsung di **Google Stitch** atau AI UI generator lainnya, gunakan prompt terstruktur berikut:

```text
Design a high-end, responsive retail Point of Sale (POS) Customer Facing Display and Multi-Store Hub in 2 complete screens using clean white retail aesthetics (#FFFFFF cards, #F1F5F9 canvas, #7C4E2F roasted coffee accents, and #059669 emerald success highlights).

Screen 1: Customer Facing Display (16:9 Widescreen Split 65/35)
- Header: Brand logo "TOKO BERKAH JAYA", branch badge "Cabang Samarinda Kota", active status, and real-time digital clock (WITA).
- Left Section (65% width): Supermarket shopping cart table with columns (No, Product Name with barcode subtitle, Qty badge "2 Pcs @ Rp 38.000", and bold Subtotal). Last scanned item has soft green highlight and "BARU" badge. Bottom footer displays member loyalty name and bold green badge "Anda Hemat: Rp 5.000".
- Right Section (35% width): Unified Payment Console. Top rows show Subtotal, Member Discount, Tax 0%. Middle has a high-contrast dark coffee Grand Total card with huge bold price "Rp 114.000" and Indonesian spelled text. Bottom dynamic panel renders a Cash Tendered breakdown with an eye-catching, vibrant emerald "UANG KEMBALIAN ANDA: Rp 36.000" card.
- Footer: Running marquee promo ticker with store operating hours.

Screen 2: Multi-Store Gateway Hub (Welcome Launch Screen)
- Centered grid of store cards (Store A Sembako, Store B Branch) showing branch code, total SKU count, active cashier count, and SQLite local status.
- Includes a dashed "+ Add New Store Database" action card.
- Clicking any store triggers a modern modal with cashier profile selector and an on-screen touch PIN numpad (1-9, 0, Del).
```

---

# 7. Non-Functional Requirements & Security

1. **Performance**: Latensi pembaruan antar layar kasir dan layar pelanggan wajib di bawah **10 milidetik** saat berjalan di satu komputer (via `BroadcastChannel`) dan di bawah **100 milidetik** via Wi-Fi lokal LAN (via Server-Sent Events).
2. **Reliability & Offline-First**: Tidak boleh ada fungsi layar pelanggan atau multi-store yang macet (*hang*) jika internet terputus. Semua data tersimpan lokal di SQLite dan Dexie.
3. **Data Integrity**: Pergantian toko di Multi-Store Gateway wajib membersihkan *active state session* agar transaksi toko yang berbeda tidak saling mengotori.
4. **Display Scalability**: Antarmuka dioptimalkan secara otomatis untuk resolusi standar kasir: 1366x768, 1920x1080 (Full HD), serta rasio tablet 16:10.
