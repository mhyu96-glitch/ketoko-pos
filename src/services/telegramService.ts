/**
 * Telegram & Cloudflare Keep-Alive Service for Ketoko POS
 * Terhubung langsung ke bot @supabotborneo_bot dan Cloudflare Worker supabase-sync-worker
 */

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  workerUrl: string;
  triggerToken: string;
  enabled: boolean;
  notifyOnSale: boolean;
  notifyOnShiftClose: boolean;
  notifyOnKeepAlive: boolean;
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '8956076739:AAH4fNHKjJ98ydA3RldunnsHxBnqZvLKf6A',
  chatId: '8538912183',
  workerUrl: 'https://supabase-sync-worker.m-hyu96.workers.dev',
  triggerToken: 'trig_m4k9w2p7v1n8q3r5x0_supabase',
  enabled: true,
  notifyOnSale: false,
  notifyOnShiftClose: true,
  notifyOnKeepAlive: true
};

export function getTelegramConfig(): TelegramConfig {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_TELEGRAM_CONFIG;
  }
  try {
    const raw = localStorage.getItem('ketoko_telegram_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_TELEGRAM_CONFIG,
        ...parsed,
        botToken: parsed.botToken || DEFAULT_TELEGRAM_CONFIG.botToken,
        chatId: parsed.chatId || DEFAULT_TELEGRAM_CONFIG.chatId,
        workerUrl: parsed.workerUrl || DEFAULT_TELEGRAM_CONFIG.workerUrl
      };
    }
  } catch {}
  return DEFAULT_TELEGRAM_CONFIG;
}

export function saveTelegramConfig(config: Partial<TelegramConfig>): TelegramConfig {
  const current = getTelegramConfig();
  const updated: TelegramConfig = { ...current, ...config };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ketoko_telegram_config', JSON.stringify(updated));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ketoko_telegram_config_changed', { detail: updated }));
  }
  return updated;
}

/**
 * Mengirim pesan teks langsung ke Bot Telegram
 */
export async function sendTelegramMessage(text: string, parseMode: 'Markdown' | 'HTML' = 'HTML'): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getTelegramConfig();
  if (!config.enabled || !config.botToken || !config.chatId) {
    return { success: false, message: 'Bot Token atau Chat ID belum dikonfigurasi.' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId.trim(),
        text,
        parse_mode: parseMode
      })
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true, message: 'Pesan berhasil dikirim ke Telegram!' };
    }
    return { success: false, message: data.description || 'Gagal mengirim pesan Telegram.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menghubungi Telegram API.' };
  }
}

/**
 * Uji konektivitas bot Telegram (getMe + ping message)
 */
export async function testTelegramConnection(): Promise<{
  success: boolean;
  botName?: string;
  username?: string;
  latencyMs?: number;
  message: string;
}> {
  const config = getTelegramConfig();
  const start = performance.now();

  try {
    const resMe = await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/getMe`);
    const dataMe = await resMe.json();
    const latencyMs = Math.round(performance.now() - start);

    if (!dataMe.ok) {
      return {
        success: false,
        message: `Token Bot tidak valid: ${dataMe.description || 'Periksa kembali Token Bot.'}`
      };
    }

    const botName = dataMe.result?.first_name || 'Bot Telegram';
    const username = dataMe.result?.username || '';

    // Kirim pesan verifikasi ke Chat ID
    const sendResult = await sendTelegramMessage(
      `⚡ <b>Ketoko POS: Tes Koneksi Berhasil!</b>\n\n` +
      `🤖 Bot: <b>${botName}</b> (@${username})\n` +
      `⏱️ Latensi API: <b>${latencyMs}ms</b>\n` +
      `📅 Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
      `<i>Sistem Ketoko POS Anda kini telah terhubung ke Telegram ini.</i>`
    );

    if (!sendResult.success) {
      return {
        success: false,
        botName,
        username,
        latencyMs,
        message: `Bot valid (@${username}), tapi gagal kirim ke Chat ID ${config.chatId}: ${sendResult.message}`
      };
    }

    return {
      success: true,
      botName,
      username,
      latencyMs,
      message: `Terhubung sempurna dengan @${username}! Notifikasi tes terkirim (${latencyMs}ms).`
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal terhubung ke Telegram API. Periksa koneksi internet.'
    };
  }
}

/**
 * Memicu sinkronisasi manual Supabase via Cloudflare Worker
 */
export async function triggerWorkerSync(): Promise<{
  success: boolean;
  message: string;
}> {
  const config = getTelegramConfig();
  if (!config.workerUrl) {
    return { success: false, message: 'URL Cloudflare Worker belum diatur.' };
  }

  try {
    const res = await fetch(`${config.workerUrl.replace(/\/+$/, '')}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.triggerToken.trim()}`
      }
    });

    const data = await res.json();
    if (res.ok) {
      return {
        success: true,
        message: data.message || 'Sinkronisasi dimulai. Laporan segera masuk ke Telegram Anda.'
      };
    }
    return {
      success: false,
      message: data.error || data.message || `Worker mengembalikan status ${res.status}`
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menghubungi Cloudflare Worker.'
    };
  }
}

/**
 * Mengambil status kesehatan Cloudflare Keep-Alive Worker
 */
export async function fetchWorkerHealth(): Promise<{
  success: boolean;
  data?: any;
  message: string;
}> {
  const config = getTelegramConfig();
  if (!config.workerUrl) {
    return { success: false, message: 'URL Worker belum diatur.' };
  }

  try {
    const res = await fetch(`${config.workerUrl.replace(/\/+$/, '')}/health`);
    const data = await res.json();
    if (res.ok) {
      return { success: true, data, message: 'Worker sehat dan aktif.' };
    }
    return { success: false, message: `Status worker: ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menghubungi endpoint worker /health.' };
  }
}

/**
 * Kirim notifikasi penjualan baru ke Telegram
 */
export async function notifySaleToTelegram(trx: {
  receipt_number: string;
  grand_total: number;
  cashier_name?: string;
  payment_method: string;
  store_name?: string;
  total_items?: number;
}) {
  const config = getTelegramConfig();
  if (!config.enabled || !config.notifyOnSale) return;

  const totalFormatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(trx.grand_total);

  const text = 
    `🛒 <b>TRANSAKSI PENJUALAN POS</b>\n` +
    `🏪 Toko: <b>${trx.store_name || 'Ketoko POS'}</b>\n` +
    `🧾 No. Nota: <code>${trx.receipt_number}</code>\n` +
    `💰 Total: <b>${totalFormatted}</b> (${trx.total_items || 1} item)\n` +
    `💳 Metode: <b>${trx.payment_method}</b>\n` +
    `👤 Kasir: ${trx.cashier_name || 'Kasir'}\n` +
    `⏰ ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

  await sendTelegramMessage(text, 'HTML');
}

