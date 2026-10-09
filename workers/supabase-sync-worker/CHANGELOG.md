# Changelog

Semua perubahan penting pada Supabase Sync Worker dicatat di file ini.

## 2.0.0 — 2026-07-15

### Ditambahkan

- Uptime pada setiap laporan sync, dihitung sejak 1 Maret 2026 pukul 00:00 WITA.
- Jadwal sync tiga kali sehari pada 08:00, 16:00, dan 23:00 WITA.
- Tombol Telegram **Sync sekarang**, **Status**, dan **Riwayat**.
- Verifikasi rahasia pada Telegram webhook.
- Status khusus untuk project paused, key ditolak, RPC hilang, timeout, dan gangguan jaringan.
- Penyimpanan status per node dan riwayat per proses di Cloudflare KV.
- Health check berdasarkan hasil Supabase sebenarnya.
- Structured logging dan Cloudflare Workers observability.
- Migration SQL yang lebih aman dengan `search_path` dan izin fungsi terbatas.
- Tes otomatis memakai Node.js test runner.
- Panduan pemasangan baru untuk pengguna pemula.

### Diubah

- Jadwal lama sekali sehari diganti menjadi tiga kali sehari.
- Jadwal terakhir yang sebelumnya direncanakan pukul 00:00 WITA diubah menjadi 23:00 WITA.
- Konfigurasi dipindah dari `wrangler.toml` ke `wrangler.jsonc`.
- `/trigger` dan `/set-webhook` sekarang hanya menerima metode `POST`.
- `/sync-history` sekarang memerlukan Bearer token.
- `TELEGRAM_BOT_TOKEN` menjadi nama token bot utama; `NEW_BOT_TOKEN` hanya dipertahankan sebagai fallback sementara.
- Cron dianggap gagal jika semua node Supabase gagal, sehingga Cloudflare Past Events tidak memberi status sukses palsu.

### Diperbaiki

- Migration sekarang menghapus fungsi lama sebelum mengganti return type dari `JSON` menjadi `JSONB`.
- Konversi waktu UTC ke WITA yang sebelumnya salah.
- Timeout sekarang selalu dibersihkan melalui blok `finally`.
- Promise balasan Telegram tidak lagi dibiarkan berjalan tanpa dilacak.
- Endpoint `/health` tidak lagi selalu mengatakan `ok` saat Supabase bermasalah.

## 1.0.0

- Versi awal Worker dengan sync Supabase, cron harian, KV, dan notifikasi Telegram.
