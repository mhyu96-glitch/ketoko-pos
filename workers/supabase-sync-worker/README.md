# Supabase Sync Worker

Worker kecil ini membantu project Supabase Free tetap punya aktivitas database.

Worker akan mengetuk Supabase **3 kali sehari**:

- 08:00 WITA
- 16:00 WITA
- 23:00 WITA

Worker juga mengirim hasilnya ke Telegram. Di bot Telegram tersedia tombol:

- **Sync sekarang** — periksa Supabase sekarang juga.
- **Status** — lihat kondisi Supabase terakhir.
- **Riwayat** — lihat laporan terakhir.

Setiap laporan sync menampilkan uptime bot yang dihitung sejak **1 Maret 2026 pukul 00:00 WITA**. Ini adalah umur layanan, bukan umur proses Cloudflare, karena proses Worker dapat hidup dan mati otomatis.

> Penting: alat ini membantu mengurangi risiko pause, tetapi tidak bisa memberi jaminan 100%. Supabase Free masih boleh melakukan pause berdasarkan penilaian aktivitas mereka. Project berbayar tidak terkena pause karena tidak aktif.

## Kalau Supabase sudah paused

Worker tidak bisa menyalakan project yang sudah paused.

Lakukan ini dulu:

1. Buka [Supabase Dashboard](https://supabase.com/dashboard).
2. Pilih project yang bertuliskan **Paused**.
3. Tekan **Resume project**.
4. Tunggu sampai project hidup lagi.
5. Baru lanjutkan langkah pemasangan di bawah.

## Yang perlu disiapkan

Sebelum mulai, siapkan:

- Akun Cloudflare.
- Project Supabase yang sudah hidup.
- Bot Telegram dari `@BotFather`.
- Node.js versi 20 atau lebih baru.

## Langkah 1 — Masuk ke folder Worker

Buka Terminal, lalu jalankan:

```bash
cd supabase-sync-worker
npm install
```

Semua perintah berikutnya dijalankan dari folder ini.

## Langkah 2 — Pasang fungsi di Supabase

Lakukan langkah ini di **setiap project Supabase** yang ingin dijaga.

1. Buka Supabase Dashboard.
2. Pilih project.
3. Buka menu **SQL Editor**.
4. Buka file [`migrations/001_sync_application_data.sql`](migrations/001_sync_application_data.sql).
5. Salin semua isi file.
6. Tempel ke SQL Editor.
7. Tekan **Run**.

Migration akan menghapus fungsi sync versi lama lalu membuat versi baru. Tabel dan data `app_configurations` tidak ikut dihapus.

Hasil tes paling bawah harus memiliki nilai seperti ini:

```json
{
  "status": "synchronized",
  "affected_rows": 1
}
```

Kalau `affected_rows` bernilai `1`, berarti fungsi sudah siap.

Kalau sebelumnya muncul error `cannot change return type of existing function`, jalankan ulang migration terbaru dari awal. Baris `drop function if exists` akan membereskan fungsi versi lama.

## Langkah 3 — Ambil URL dan key Supabase

Pada Supabase Dashboard:

1. Buka project.
2. Buka **Project Settings**.
3. Buka bagian **API**.
4. Salin **Project URL**.
5. Salin **anon/public key**.

Jangan memakai password database. Worker ini hanya memerlukan URL dan anon key.

## Langkah 4 — Buat bot Telegram

1. Buka Telegram.
2. Cari `@BotFather`.
3. Kirim `/newbot`.
4. Ikuti petunjuk sampai mendapat token bot.
5. Simpan token itu. Jangan kirim token kepada orang lain.

Untuk mencari Chat ID, kirim pesan ke bot lalu gunakan cara Chat ID yang biasa Anda pakai. Chat ID dipakai agar bot hanya melayani chat milik Anda.

## Langkah 5 — Masuk ke Cloudflare

Jalankan:

```bash
npx wrangler login
```

Browser akan terbuka. Izinkan Wrangler masuk ke akun Cloudflare Anda.

## Langkah 6 — Simpan rahasia

Masukkan rahasia satu per satu. Terminal akan meminta nilainya setelah perintah dijalankan.

Project Supabase pertama:

```bash
npx wrangler secret put NODE_URL_1
npx wrangler secret put NODE_KEY_1
```

Kalau ada project kedua:

```bash
npx wrangler secret put NODE_URL_2
npx wrangler secret put NODE_KEY_2
```

Nomor bisa dilanjutkan sampai `15`. Jangan melompati pasangan URL dan key.

Sekarang simpan rahasia Telegram:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Isi `TELEGRAM_WEBHOOK_SECRET` dengan teks rahasia buatan sendiri. Gunakan huruf, angka, `_`, dan `-`.

Terakhir, buat token untuk tombol manual dari HTTP:

```bash
npx wrangler secret put MANUAL_TRIGGER_TOKEN
```

Gunakan token panjang dan sulit ditebak.

> Versi lama memakai `NEW_BOT_TOKEN`. Kode masih bisa membacanya supaya bot lama tidak langsung rusak, tetapi pemasangan baru harus memakai `TELEGRAM_BOT_TOKEN`.

## Langkah 7 — Periksa sebelum deploy

Jalankan:

```bash
npm test
npm run deploy:dry
```

Kalau tidak ada error, lanjut ke deploy.

## Langkah 8 — Deploy Worker

```bash
npm run deploy
```

Setelah selesai, Wrangler menampilkan alamat Worker. Bentuknya kira-kira:

```text
https://supabase-sync-worker.NAMA-AKUN.workers.dev
```

Simpan alamat tersebut sebagai `WORKER_URL`.

Perubahan jadwal cron Cloudflare dapat memerlukan waktu beberapa menit sebelum aktif.

## Langkah 9 — Nyalakan tombol Telegram

Ganti bagian berikut:

- `WORKER_URL` dengan alamat Worker.
- `TOKEN_MANUAL` dengan isi `MANUAL_TRIGGER_TOKEN`.

Lalu jalankan:

```bash
curl -X POST "WORKER_URL/set-webhook" \
  -H "Authorization: Bearer TOKEN_MANUAL"
```

Setelah berhasil:

1. Buka bot Telegram.
2. Kirim `/start`.
3. Tombol **Sync sekarang**, **Status**, dan **Riwayat** akan muncul.

## Langkah 10 — Tes satu kali

Tekan tombol **Sync sekarang** di Telegram.

Hasil sehat terlihat seperti ini:

```text
🔄 Laporan Supabase

Waktu: 15 Jul 2026, 16.00
Uptime bot: 136 hari, 8 jam, 0 menit (sejak 1 Maret 2026)
Hasil: 2/2 node sehat
✅ Node_1: sehat
✅ Node_2: sehat
```

Kalau project paused, bot akan memberi pesan agar project di-resume melalui Supabase Dashboard.

## Jadwal cron

Cloudflare membaca cron dalam waktu UTC, bukan WITA.

| Cron UTC | Waktu WITA |
|---|---|
| `0 0 * * *` | 08:00 WITA |
| `0 8 * * *` | 16:00 WITA |
| `0 15 * * *` | 23:00 WITA |

Jadi jadwal terakhir benar-benar pukul **23:00 WITA**, bukan pukul 00:00.

## Endpoint

### Cek kesehatan

```bash
curl "WORKER_URL/health"
```

Kemungkinan status:

- `healthy`: semua node sehat.
- `degraded`: sebagian node bermasalah.
- `unhealthy`: semua gagal, ada project paused, atau data sudah terlalu lama.
- `unknown`: belum pernah sync atau KV belum tersedia.

### Sync manual

Endpoint ini hanya menerima `POST`:

```bash
curl -X POST "WORKER_URL/trigger" \
  -H "Authorization: Bearer TOKEN_MANUAL"
```

### Melihat riwayat

```bash
curl "WORKER_URL/sync-history" \
  -H "Authorization: Bearer TOKEN_MANUAL"
```

## Perintah Telegram

- `/start` — tampilkan tombol.
- `/ping` — periksa apakah bot hidup.
- `/sync` — jalankan sync sekarang.
- `/status` — lihat kondisi terakhir.
- `/memory` — lihat laporan terakhir.

Bot hanya menerima perintah dari `TELEGRAM_CHAT_ID` yang dipasang.

## Arti error sederhana

| Pesan | Artinya | Yang dilakukan |
|---|---|---|
| `paused` | Project sedang tidur | Buka Dashboard lalu tekan **Resume project** |
| `key salah/ditolak` | URL atau anon key salah | Pasang ulang `NODE_URL_x` dan `NODE_KEY_x` |
| `fungsi RPC belum ada` | SQL belum dipasang | Jalankan file migration di SQL Editor |
| `terlalu lama` | Supabase tidak menjawab dalam 10 detik | Tunggu lalu coba lagi |
| `KV SYNC_MEMORY belum dipasang` | Penyimpanan status belum tersedia | Periksa binding KV di `wrangler.jsonc` |

## Melihat log

```bash
npm run tail
```

Log juga tersimpan di Cloudflare Dashboard karena observability sudah dinyalakan.

## Catatan keamanan

- Jangan menaruh token asli di README, Git, atau chat publik.
- Gunakan `wrangler secret put` untuk semua token dan key.
- `/trigger`, `/sync-history`, dan `/set-webhook` dilindungi token.
- Telegram webhook diperiksa memakai `TELEGRAM_WEBHOOK_SECRET`.
- Kalau token bot bocor, buat token baru lewat `@BotFather`.

## Batas Free Plan

Worker membuat aktivitas database tiga kali sehari untuk mengurangi risiko project dianggap tidak aktif. Namun keputusan pause tetap milik Supabase. Untuk layanan penting yang harus selalu hidup, gunakan paket Supabase berbayar.
