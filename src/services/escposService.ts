import type { Transaction } from '../types';
import type { PrinterConfig } from '../components/PrinterSettingsModal';
import { db } from '../db';

// Standard ESC/POS Constants from Technical Spec
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

export const ESCPOS_CMD = {
  INIT: [ESC, 0x40],                     // Initialize Printer
  ALIGN_CENTER: [ESC, 0x61, 0x01],       // Center Alignment
  ALIGN_LEFT: [ESC, 0x61, 0x00],         // Left Alignment
  ALIGN_RIGHT: [ESC, 0x61, 0x02],        // Right Alignment
  BOLD_ON: [ESC, 0x45, 0x01],            // Emphasized Mode ON
  BOLD_OFF: [ESC, 0x45, 0x00],           // Emphasized Mode OFF
  DOUBLE_HEIGHT: [GS, 0x21, 0x01],       // Double height text
  DOUBLE_WIDTH: [GS, 0x21, 0x10],        // Double width text
  DOUBLE_HW: [GS, 0x21, 0x11],           // Double height + width
  NORMAL_TEXT: [GS, 0x21, 0x00],         // Normal text
  CUT_PAPER: [GS, 0x56, 0x42, 0x00],     // Partial Cut Paper
  FULL_CUT: [GS, 0x56, 0x00],            // Full Cut
  DRAWER_KICK: [ESC, 0x70, 0x00, 0x19, 0xFA] // Kick Cash Drawer
};

export class ESCPOSBuilder {
  private buffer: number[] = [];
  public paperWidth: number;

  constructor(options: { paperWidth?: number } = {}) {
    this.paperWidth = options.paperWidth || 58;
    this.addCommand(ESCPOS_CMD.INIT);
  }

  addCommand(cmd: number[]): this {
    this.buffer.push(...cmd);
    return this;
  }

  addText(text: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  addLine(text: string = ''): this {
    this.addText(text);
    this.buffer.push(LF);
    return this;
  }

  alignCenter(): this {
    return this.addCommand(ESCPOS_CMD.ALIGN_CENTER);
  }

  alignLeft(): this {
    return this.addCommand(ESCPOS_CMD.ALIGN_LEFT);
  }

  alignRight(): this {
    return this.addCommand(ESCPOS_CMD.ALIGN_RIGHT);
  }

  bold(enable: boolean = true): this {
    return this.addCommand(enable ? ESCPOS_CMD.BOLD_ON : ESCPOS_CMD.BOLD_OFF);
  }

  textSize(size: 'normal' | 'double_h' | 'double_w' | 'double_hw'): this {
    if (size === 'double_hw') return this.addCommand(ESCPOS_CMD.DOUBLE_HW);
    if (size === 'double_h') return this.addCommand(ESCPOS_CMD.DOUBLE_HEIGHT);
    if (size === 'double_w') return this.addCommand(ESCPOS_CMD.DOUBLE_WIDTH);
    return this.addCommand(ESCPOS_CMD.NORMAL_TEXT);
  }

  openDrawer(): this {
    return this.addCommand(ESCPOS_CMD.DRAWER_KICK);
  }

  cut(autoCut = true): this {
    this.addLine().addLine().addLine();
    if (autoCut) {
      this.addCommand(ESCPOS_CMD.CUT_PAPER);
    }
    return this;
  }

  // Centered Raster Bitmap Image Converter for Store Logo
  addRasterImage(width: number, height: number, bitmapData: Uint8Array): this {
    this.alignCenter();
    const widthBytes = Math.ceil(width / 8);
    const xL = widthBytes % 256;
    const xH = Math.floor(widthBytes / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    // GS v 0 0 xL xH yL yH
    this.addCommand([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    for (let i = 0; i < bitmapData.length; i++) {
      this.buffer.push(bitmapData[i]);
    }
    this.addLine();
    return this;
  }

  buildTestPrint(config?: Partial<PrinterConfig>): Uint8Array {
    const width = (config?.paperWidth === '80mm' || this.paperWidth === 80) ? 48 : 32;
    const style = config?.receiptStyle || 'modern';
    
    this.alignCenter()
      .textSize('double_hw')
      .bold(true)
      .addLine('KETOKO POS')
      .textSize('normal')
      .bold(false)
      .addLine('Thermal ESC/POS Hardware Ready')
      .addLine('Linux & WebUSB Driver OK')
      .addLine('='.repeat(width))
      .alignLeft()
      .addLine(`Waktu   : ${new Date().toLocaleString('id-ID')}`)
      .addLine(`Kertas  : ${width === 48 ? '80mm (48 Kolom)' : '58mm (32 Kolom)'}`)
      .addLine(`Gaya    : ${style.toUpperCase()}`)
      .addLine(`Driver  : ${config?.driverType || 'WEBUSB / SERIAL'}`)
      .addLine('-'.repeat(width))
      .addLine('UJI FORMAT & ANGKA:')
      .addLine(formatRow('1. Minyak Goreng 2L', 'Rp 34.000', width))
      .addLine(formatRow('2. Beras Ramos 5kg', 'Rp 65.000', width))
      .addLine(formatRow('3. Kopi Kapal Api', 'Rp 12.500', width))
      .addLine('-'.repeat(width))
      .bold(true)
      .addLine(formatRow('TOTAL BELANJA', 'Rp 111.500', width))
      .bold(false)
      .addLine('='.repeat(width))
      .alignCenter()
      .addLine('*** TEST CETAK BERHASIL ***')
      .addLine('Printer Beroperasi Normal')
      .cut(config?.autoCut !== false);

    return this.getUint8Array();
  }

  buildConfiguredReceipt(
    transaction: Transaction,
    config: PrinterConfig
  ): Uint8Array {
    const width = config.paperWidth === '80mm' ? 48 : 32;
    const style = config.receiptStyle || 'modern';

    // 1. Header Area
    this.alignCenter();

    // Store Name & Header Text
    const headerLines = (config.headerText || 'KETOKO MODERN POS\nJl. Pahlawan No. 45 Samarinda').split('\n');
    if (headerLines.length > 0) {
      this.bold(true)
        .textSize(style === 'modern' || style === 'detailed' ? 'double_h' : 'normal')
        .addLine(headerLines[0])
        .textSize('normal')
        .bold(false);
      for (let i = 1; i < headerLines.length; i++) {
        this.addLine(headerLines[i]);
      }
    }

    if (config.showQueueNumber) {
      this.bold(true)
        .addLine(`*** NO. ANTRIAN: #${transaction.receipt_number.slice(-3)} ***`)
        .bold(false);
    }

    // 2. Metadata
    this.addLine('='.repeat(width))
      .alignLeft()
      .addLine(formatRow(`No : ${transaction.receipt_number}`, new Date(transaction.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), width))
      .addLine(`Tgl: ${new Date(transaction.created_at).toLocaleDateString('id-ID')}`);

    if (config.showCashier) {
      this.addLine(`Ksr: ${transaction.cashier_name || 'Kasir'} (BR-01)`);
    }

    if (transaction.customer_name || transaction.member_id) {
      const cleanCust = (transaction.customer_name || '').replace(/^Member #/i, '').trim();
      this.addLine(`Plg: ${cleanCust || `Member ${transaction.member_id}`}`);
    }

    this.addLine('-'.repeat(width));

    // 3. Items
    for (let i = 0; i < transaction.items.length; i++) {
      const item = transaction.items[i];
      if (style === 'compact') {
        const shortName = item.product_name.slice(0, width - 14);
        const qtyRow = `${item.qty}x ${shortName}`;
        this.addLine(formatRow(qtyRow, formatRupiah(item.subtotal_item), width));
      } else {
        this.addLine(`${i + 1}. ${item.product_name.slice(0, width)}`);
        const qtyPrice = `   ${item.qty} x ${formatRupiah(item.price_applied)}` + (item.is_wholesale ? ' [GROSIR]' : '');
        this.addLine(formatRow(qtyPrice, formatRupiah(item.subtotal_item), width));
      }
    }

    this.addLine('-'.repeat(width));

    // 4. Totals & Calculations
    this.addLine(formatRow('Subtotal', formatRupiah(transaction.subtotal), width));

    if (config.showDiscountSaving && transaction.discount_amount > 0) {
      this.addLine(formatRow('Diskon Promo', '-' + formatRupiah(transaction.discount_amount), width));
    }

    if (transaction.tax_amount > 0) {
      const netBase = Math.max(1, transaction.subtotal - (transaction.discount_amount || 0));
      const ratePercent = Math.round((transaction.tax_amount / netBase) * 100);
      this.addLine(formatRow(`PPN (${ratePercent}%)`, formatRupiah(transaction.tax_amount), width));
    }

    this.bold(true)
      .textSize('double_h')
      .addLine(formatRow('TOTAL', formatRupiah(transaction.grand_total), width))
      .textSize('normal')
      .bold(false);

    this.addLine(formatRow(`Bayar (${transaction.payment_method})`, formatRupiah(transaction.cash_given), width))
      .addLine(formatRow('Kembalian', formatRupiah(transaction.change_returned), width));

    if (config.showDiscountSaving && transaction.discount_amount > 0) {
      this.alignCenter()
        .bold(true)
        .addLine(`*** ANDA HEMAT: ${formatRupiah(transaction.discount_amount)} ***`)
        .bold(false)
        .alignLeft();
    }

    this.addLine('='.repeat(width));

    // 5. Footer Area
    this.alignCenter();
    const footerLines = (config.footerText || 'Terima kasih atas kunjungan Anda!').split('\n');
    for (const fl of footerLines) {
      this.addLine(fl);
    }

    if (config.showBarcodeFooter) {
      this.addLine(`[ ${transaction.receipt_number} ]`);
    }

    this.cut(config.autoCut);

    return this.getUint8Array();
  }

  getUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

// Formatter helper for receipt printing (32 characters wide for 58mm printer, 48 for 80mm)
export function formatRow(left: string, right: string, width = 32): string {
  const leftLen = left.length;
  const rightLen = right.length;
  const spaces = Math.max(1, width - leftLen - rightLen);
  return left + ' '.repeat(spaces) + right;
}

export function formatRupiah(num: number): string {
  return 'Rp ' + (num || 0).toLocaleString('id-ID');
}

let cachedUsbDevice: any = null;

/**
 * Direct WebUSB Printer Driver (Windows WinUSB / Linux / Chromium / Edge)
 * Supports Xprinter, Epson, POS-58, POS-80, Panda, Sunmi, VSC, Eppos, Iware
 * Otomatis fallback ke Windows Thermal Spooler jika port USB dikunci oleh driver Windows (usbprint.sys)
 */
export async function printToWebUSB(data: Uint8Array, forceNewDevice = false): Promise<{ success: boolean; message: string }> {
  try {
    if (!('usb' in navigator)) {
      return await printRawBufferViaSpooler(data);
    }

    let device: any = !forceNewDevice ? cachedUsbDevice : null;
    if (!device && !forceNewDevice && typeof (navigator as any).usb.getDevices === 'function') {
      try {
        const permitted = await (navigator as any).usb.getDevices();
        if (permitted && permitted.length > 0) {
          device = permitted[0];
        }
      } catch {}
    }

    if (!device) {
      // @ts-ignore
      device = await navigator.usb.requestDevice({ filters: [] });
    }

    cachedUsbDevice = device;
    await device.open();

    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find printer interface and bulk OUT endpoint
    let targetInterfaceNumber = 0;
    let targetEndpointNumber = 1;
    let foundOutEndpoint = false;

    for (const iface of device.configuration?.interfaces || []) {
      for (const alt of iface.alternates || []) {
        for (const ep of alt.endpoints || []) {
          if (ep.direction === 'out' && ep.type === 'bulk') {
            targetInterfaceNumber = iface.interfaceNumber;
            targetEndpointNumber = ep.endpointNumber;
            foundOutEndpoint = true;
            break;
          }
        }
        if (foundOutEndpoint) break;
      }
      if (foundOutEndpoint) break;
    }

    await device.claimInterface(targetInterfaceNumber);
    await device.transferOut(targetEndpointNumber, data);
    await device.close();

    return { 
      success: true, 
      message: `Berhasil mencetak ke ${device.productName || 'USB Printer'} via WebUSB!` 
    };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return { success: false, message: 'Pemilihan printer USB dibatalkan oleh pengguna.' };
    }
    const msg = String(err.message || '').toLowerCase();
    // Di Windows 10/11, driver bawaan Windows (POS-58 / POS-80 / usbprint.sys) mengunci interface USB.
    // Otomatis alihkan ke Windows Thermal Spooler (58mm/80mm) agar struk tetap langsung tercetak!
    if (
      err.name === 'NetworkError' ||
      err.name === 'SecurityError' ||
      msg.includes('claim interface') ||
      msg.includes('access denied') ||
      msg.includes('unable to claim')
    ) {
      return await printRawBufferViaSpooler(data);
    }
    return { 
      success: false, 
      message: 'Gagal terhubung via WebUSB: ' + (err.message || 'Perangkat tidak merespons') 
    };
  }
}

/**
 * Web Serial API Driver (Linux /dev/ttyUSB0, /dev/rfcomm0, Windows COM Bluetooth SPP)
 */
export async function printToWebSerial(data: Uint8Array, baudRate = 9600, forceNewPort = false): Promise<{ success: boolean; message: string }> {
  try {
    if (!('serial' in navigator)) {
      return { 
        success: false, 
        message: 'Web Serial API tidak didukung di browser ini. Gunakan Google Chrome atau Edge.' 
      };
    }
    let port: any = null;
    if (!forceNewPort && typeof (navigator as any).serial.getPorts === 'function') {
      const ports = await (navigator as any).serial.getPorts();
      if (ports && ports.length > 0) {
        port = ports[0];
      }
    }
    if (!port) {
      // @ts-ignore
      port = await navigator.serial.requestPort();
    }
    if (!port.readable && !port.writable) {
      await port.open({ baudRate });
    }
    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    await new Promise((r) => setTimeout(r, 100));
    await port.close().catch(() => {});
    return { success: true, message: 'Berhasil mencetak via Port Serial / Bluetooth SPP!' };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return { success: false, message: 'Pemilihan port serial dibatalkan.' };
    }
    return { success: false, message: err.message || 'Gagal terhubung ke Serial Printer' };
  }
}

/**
 * Daftar Lengkap UUID Service Printer Bluetooth POS (BLE / ESC-POS)
 * Mencakup Eppos, VSC, Panda, Iware, Xprinter, RPP02N, BellaV, Goojprt, Zjiang, Cashino, Sunmi, MPT-II
 */
export const BLUETOOTH_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE POS Printer (0x18F0)
  '0000ff00-0000-1000-8000-00805f9b34fb', // Eppos / VSC / Panda / Zjiang / Iware (0xFF00)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Xprinter / Star / Custom BLE
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / Transparent UART (0xFFE0)
  '0000ffe5-0000-1000-8000-00805f9b34fb', // BLE UART Printer (0xFFE5)
  '0000fee7-0000-1000-8000-00805f9b34fb', // WeChat / Chinese BLE Printer (0xFEE7)
  '0000ae30-0000-1000-8000-00805f9b34fb', // JieLi BLE Thermal Printer (0xAE30)
  '0000ae00-0000-1000-8000-00805f9b34fb', // JieLi BLE Series (0xAE00)
  '0000fff0-0000-1000-8000-00805f9b34fb', // Custom BLE Thermal Printer (0xFFF0)
  '00001101-0000-1000-8000-00805f9b34fb', // SPP over GATT (0x1101)
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '00001800-0000-1000-8000-00805f9b34fb',
  '00001801-0000-1000-8000-00805f9b34fb',
  '0000180a-0000-1000-8000-00805f9b34fb'
];

let cachedBluetoothDevice: any = null;
let cachedBluetoothWriteChar: any = null;

export function getBluetoothPrinterStatus(): { connected: boolean; deviceName: string | null } {
  const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('ketoko_bt_printer_name') : null;
  const isConnected = Boolean(cachedBluetoothDevice && cachedBluetoothDevice.gatt?.connected && cachedBluetoothWriteChar);
  return {
    connected: isConnected,
    deviceName: cachedBluetoothDevice?.name || savedName || null
  };
}

export function disconnectBluetoothPrinter(): void {
  try {
    if (cachedBluetoothDevice?.gatt?.connected) {
      cachedBluetoothDevice.gatt.disconnect();
    }
  } catch {}
  cachedBluetoothDevice = null;
  cachedBluetoothWriteChar = null;
}

async function resolveWriteCharacteristic(server: any): Promise<any> {
  const IgnoredGenericServices = new Set([
    '00001800-0000-1000-8000-00805f9b34fb',
    '00001801-0000-1000-8000-00805f9b34fb',
    '0000180a-0000-1000-8000-00805f9b34fb'
  ]);

  let services: any[] = [];
  try {
    services = await server.getPrimaryServices();
  } catch {
    services = [];
  }

  // Jika getPrimaryServices() kosong, coba satu per satu dari daftar UUID printer
  if (!services || services.length === 0) {
    for (const uuid of BLUETOOTH_PRINTER_SERVICES) {
      try {
        const s = await server.getPrimaryService(uuid);
        if (s) services.push(s);
      } catch {}
    }
  }

  let fallbackChar: any = null;

  for (const service of services) {
    const serviceUuid = String(service.uuid || '').toLowerCase();
    const isGeneric = IgnoredGenericServices.has(serviceUuid);
    try {
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties?.writeWithoutResponse || c.properties?.write) {
          if (!isGeneric) {
            return c;
          }
          if (!fallbackChar) {
            fallbackChar = c;
          }
        }
      }
    } catch {}
  }

  return fallbackChar;
}

/**
 * Cari & Hubungkan Printer Bluetooth (Bisa dipanggil langsung dari Pengaturan Printer atau saat Cetak)
 */
export async function connectBluetoothPrinter(forceNewDevice = true): Promise<{
  success: boolean;
  deviceName?: string;
  message: string;
}> {
  try {
    if (!('bluetooth' in navigator)) {
      return {
        success: false,
        message: 'Web Bluetooth tidak didukung di browser ini. Gunakan Google Chrome / Edge (pastikan HTTPS atau localhost & Bluetooth menyala).'
      };
    }

    // 1. Gunakan koneksi aktif jika sudah terhubung dan tidak diminta ganti perangkat
    if (!forceNewDevice && cachedBluetoothDevice?.gatt?.connected && cachedBluetoothWriteChar) {
      const name = cachedBluetoothDevice.name || 'Printer Bluetooth POS';
      return {
        success: true,
        deviceName: name,
        message: `Terhubung ke ${name}`
      };
    }

    let device = !forceNewDevice ? cachedBluetoothDevice : null;

    // 2. Coba ambil dari daftar perangkat yang sudah diizinkan sebelumnya di browser
    if (!device && !forceNewDevice && typeof (navigator as any).bluetooth.getDevices === 'function') {
      try {
        const permitted = await (navigator as any).bluetooth.getDevices();
        if (permitted && permitted.length > 0) {
          const savedName = localStorage.getItem('ketoko_bt_printer_name');
          device = (savedName && permitted.find((d: any) => d.name === savedName)) || permitted[0];
        }
      } catch {}
    }

    // 3. Jika belum ada perangkat, buka dialog pemilihan Bluetooth
    if (!device) {
      // @ts-ignore
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLUETOOTH_PRINTER_SERVICES
      });
    }

    if (!device) {
      return { success: false, message: 'Perangkat Bluetooth tidak dipilih.' };
    }

    device.addEventListener?.('gattserverdisconnected', () => {
      cachedBluetoothWriteChar = null;
    });

    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error('Gagal menghubungkan ke Bluetooth GATT Server. Pastikan printer menyala & tidak sedang terhubung ke HP/komputer lain.');
    }

    const writeChar = await resolveWriteCharacteristic(server);
    if (!writeChar) {
      throw new Error(
        'Karakteristik cetak BLE tidak ditemukan pada perangkat ini. Jika printer menggunakan Bluetooth Classic (SPP/COM), gunakan tombol "Konek via Bluetooth SPP / Serial" di bawah.'
      );
    }

    cachedBluetoothDevice = device;
    cachedBluetoothWriteChar = writeChar;
    const devName = device.name || 'Printer Bluetooth POS';
    try {
      localStorage.setItem('ketoko_bt_printer_name', devName);
    } catch {}

    return {
      success: true,
      deviceName: devName,
      message: `Berhasil terhubung ke printer "${devName}"!`
    };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return { success: false, message: 'Pencarian printer Bluetooth dibatalkan.' };
    }
    return {
      success: false,
      message: err.message || 'Gagal menghubungkan ke printer Bluetooth.'
    };
  }
}

async function writeBleChunkSafe(writeChar: any, chunk: Uint8Array): Promise<void> {
  if (writeChar.properties?.writeWithoutResponse && typeof writeChar.writeValueWithoutResponse === 'function') {
    await writeChar.writeValueWithoutResponse(chunk);
  } else if (typeof writeChar.writeValueWithResponse === 'function') {
    await writeChar.writeValueWithResponse(chunk);
  } else {
    await writeChar.writeValue(chunk);
  }
}

/**
 * Web Bluetooth POS Printer Driver (BLE / ESCPOS)
 */
export async function printToWebBluetooth(data: Uint8Array): Promise<{ success: boolean; message: string }> {
  try {
    // Pastikan terhubung (gunakan koneksi tersimpan atau minta pairing jika belum)
    if (!cachedBluetoothDevice?.gatt?.connected || !cachedBluetoothWriteChar) {
      const conn = await connectBluetoothPrinter(false);
      if (!conn.success || !cachedBluetoothWriteChar) {
        return { success: false, message: conn.message };
      }
    }

    const writeChar = cachedBluetoothWriteChar;
    const deviceName = cachedBluetoothDevice?.name || localStorage.getItem('ketoko_bt_printer_name') || 'Bluetooth Printer';

    // Kirim per 100 byte dengan jeda 15ms agar buffer UART printer thermal 58mm/80mm tidak penuh/putus
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      try {
        await writeBleChunkSafe(writeChar, chunk);
      } catch {
        // Fallback otomatis ke paket 20 byte untuk printer BLE generasi lama (MTU 23)
        for (let j = 0; j < chunk.length; j += 20) {
          const miniChunk = chunk.slice(j, j + 20);
          await writeBleChunkSafe(writeChar, miniChunk);
          await new Promise((r) => setTimeout(r, 10));
        }
      }
      if (i + chunkSize < data.length) {
        await new Promise((r) => setTimeout(r, 15));
      }
    }

    // Beri waktu buffer printer menyelesaikan cetak baris terakhir (jangan langsung disconnect)
    await new Promise((r) => setTimeout(r, 120));

    return { success: true, message: `Berhasil mencetak ke ${deviceName}!` };
  } catch (err: any) {
    // Jika koneksi terputus di tengah jalan, reset karakteristik agar percobaan berikutnya auto-reconnect
    cachedBluetoothWriteChar = null;
    if (err.name === 'NotFoundError') {
      return { success: false, message: 'Pemilihan Bluetooth dibatalkan.' };
    }
    return { success: false, message: err.message || 'Gagal cetak via Bluetooth' };
  }
}

/**
 * Cetak HTML terisolasi lewat Hidden Iframe (untuk Windows Spooler POS-58 / POS-80 / CUPS)
 * Hanya mencetak struk thermal 58mm/80mm tanpa ikut mencetak tampilan layar kasir web
 */
function printHtmlInIsolatedFrame(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
  setTimeout(() => {
    try {
      iframe.remove();
    } catch {}
  }, 25000);
}

/**
 * Konversi raw byte ESC/POS menjadi cetakan Windows Thermal Spooler (58mm/80mm)
 */
export async function printRawBufferViaSpooler(
  data: Uint8Array,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<{ success: boolean; message: string }> {
  try {
    let savedWidth: '58mm' | '80mm' = paperWidth;
    try {
      const saved = localStorage.getItem('ketoko_printer_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.paperWidth === '80mm') savedWidth = '80mm';
      }
    } catch {}

    // Bersihkan byte kontrol ESC/POS menjadi teks murni baris-per-baris
    const cleanBytes: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (b === 0x1B) {
        const next = data[i + 1];
        if (next === 0x40) { i += 1; continue; }
        if (next === 0x61 || next === 0x45) { i += 2; continue; }
        if (next === 0x70) { i += 4; continue; }
        i += 1;
        continue;
      }
      if (b === 0x1D) {
        const next = data[i + 1];
        if (next === 0x21) { i += 2; continue; }
        if (next === 0x56) { i += (data[i + 2] === 0x42 ? 3 : 2); continue; }
        i += 1;
        continue;
      }
      if (b === 0x0A || b === 0x0D || (b >= 32 && b <= 126) || b >= 160) {
        cleanBytes.push(b);
      }
    }

    const text = new TextDecoder().decode(new Uint8Array(cleanBytes)).trim();
    const is80 = savedWidth === '80mm';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Struk Thermal POS</title>
  <style>
    @page {
      size: ${is80 ? '80mm' : '58mm'} auto;
      margin: 0mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${is80 ? '72mm' : '48mm'};
      margin: 0 auto;
      padding: 2mm 1mm 6mm 1mm;
      font-family: 'Courier New', Consolas, monospace;
      font-size: ${is80 ? '11.5px' : '10px'};
      line-height: 1.28;
      color: #000;
      background: #fff;
      font-weight: 600;
    }
    pre {
      font-family: inherit;
      font-size: inherit;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <pre>${escaped}</pre>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 150);
    };
  </script>
</body>
</html>`;

    printHtmlInIsolatedFrame(html);
    return {
      success: true,
      message: `Mencetak struk thermal (${savedWidth}) melalui Driver Printer Windows / OS Spooler!`
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mencetak ke Windows Thermal Spooler' };
  }
}

/**
 * Cetak Struk Kasir Thermal 58mm/80mm terformat penuh via Driver Printer Windows (POS-58 / POS-80 / Epson / Xprinter)
 */
export async function printThermalReceiptSpooler(
  transaction: Transaction,
  config: PrinterConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const is80 = config.paperWidth === '80mm';
    const headerLines = (config.headerText || 'CV. TUMBUH MAKMUR AIR CONINDO\nJl. P Antasari No.106, Samarinda Ulu').split('\n');
    const storeTitle = headerLines[0] || 'KETOKO POS';
    const storeSubLines = headerLines.slice(1);
    const footerLines = (config.footerText || 'Terima kasih atas kunjungan Anda!').split('\n');
    const cashGiven = transaction.cash_given || transaction.grand_total;
    const changeDue = Math.max(0, cashGiven - transaction.grand_total);

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Struk ${transaction.receipt_number}</title>
  <style>
    @page {
      size: ${is80 ? '80mm' : '58mm'} auto;
      margin: 0mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${is80 ? '72mm' : '48mm'};
      margin: 0 auto;
      padding: 2mm 1mm 6mm 1mm;
      font-family: 'Courier New', Consolas, 'Lucida Console', monospace;
      font-size: ${is80 ? '11.5px' : '10px'};
      line-height: 1.25;
      color: #000000;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 800; }
    .title { font-size: ${is80 ? '14px' : '12px'}; font-weight: 900; margin-bottom: 2px; }
    .sub { font-size: ${is80 ? '10.5px' : '9px'}; line-height: 1.2; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .divider-double { border-top: 2px solid #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin: 1.5px 0; }
    .item-title { font-weight: 700; margin-top: 2px; word-break: break-word; }
    .total-row { font-size: ${is80 ? '13px' : '11.5px'}; font-weight: 900; padding: 2px 0; }
    .logo { max-width: ${is80 ? '36mm' : '26mm'}; max-height: 18mm; object-fit: contain; margin: 0 auto 3px auto; display: block; filter: grayscale(100%) contrast(150%); }
    .badge { border: 1px solid #000; padding: 1px 4px; font-weight: 800; display: inline-block; margin: 2px 0; font-size: ${is80 ? '10.5px' : '9px'}; }
  </style>
</head>
<body>
  <div class="center">
    ${config.showLogo && config.logoUrl ? `<img src="${config.logoUrl}" class="logo" alt="Logo" />` : ''}
    <div class="title">${storeTitle}</div>
    ${storeSubLines.map((l) => `<div class="sub">${l}</div>`).join('')}
    ${config.showQueueNumber ? `<div class="badge">ANTRIAN #${transaction.receipt_number.slice(-3)}</div>` : ''}
  </div>

  <div class="divider-double"></div>

  <div class="row">
    <span>No: <b>${transaction.receipt_number}</b></span>
    <span>${new Date(transaction.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>
  <div class="row">
    <span>Tgl: ${new Date(transaction.created_at).toLocaleDateString('id-ID')}</span>
    ${config.showCashier ? `<span>Ksr: ${transaction.cashier_name || 'Kasir'}</span>` : ''}
  </div>
  ${transaction.customer_name || transaction.member_id ? `<div class="row"><span>Plg: <b>${(transaction.customer_name || '').replace(/^Member #/i, '').trim() || `Member #${transaction.member_id}`}</b></span></div>` : ''}

  <div class="divider"></div>

  ${transaction.items.map((item, idx) => `
    <div>
      <div class="item-title">${idx + 1}. ${item.product_name}</div>
      <div class="row">
        <span style="padding-left:8px;">${item.qty} x ${formatRupiah(item.price_applied)}</span>
        <span class="bold">${formatRupiah(item.subtotal_item)}</span>
      </div>
    </div>
  `).join('')}

  <div class="divider"></div>

  <div class="row">
    <span>Subtotal</span>
    <span>${formatRupiah(transaction.subtotal)}</span>
  </div>
  ${transaction.discount_amount > 0 ? `
  <div class="row">
    <span>Diskon</span>
    <span>-${formatRupiah(transaction.discount_amount)}</span>
  </div>` : ''}
  ${transaction.tax_amount > 0 ? `
  <div class="row">
    <span>PPN</span>
    <span>${formatRupiah(transaction.tax_amount)}</span>
  </div>` : ''}

  <div class="divider-double"></div>

  <div class="row total-row">
    <span>TOTAL</span>
    <span>${formatRupiah(transaction.grand_total)}</span>
  </div>
  <div class="row">
    <span>Bayar (${transaction.payment_method})</span>
    <span>${formatRupiah(cashGiven)}</span>
  </div>
  <div class="row bold">
    <span>${transaction.payment_method === 'TEMPO' ? 'Sisa Piutang' : 'Kembalian'}</span>
    <span>${formatRupiah(transaction.payment_method === 'TEMPO' ? Math.max(0, transaction.grand_total - cashGiven) : changeDue)}</span>
  </div>

  <div class="divider"></div>

  <div class="center" style="margin-top:4px;">
    ${footerLines.map((l) => `<div class="sub">${l}</div>`).join('')}
    ${config.showBarcodeFooter ? `<div style="margin-top:4px;font-weight:800;letter-spacing:1px;">*${transaction.receipt_number}*</div>` : ''}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 180);
    };
  </script>
</body>
</html>`;

    printHtmlInIsolatedFrame(html);
    return {
      success: true,
      message: `Struk thermal (${config.paperWidth}) berhasil dikirim ke Driver Printer Windows / OS!`
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mencetak struk thermal Windows' };
  }
}

/**
 * Uji Cetak (Test Print) untuk Driver Printer Thermal Windows (POS-58 / POS-80)
 */
export async function printThermalTestSpooler(config: PrinterConfig): Promise<{ success: boolean; message: string }> {
  const sampleTrx: Transaction = {
    id: 'TEST-THERMAL-WIN',
    receipt_number: 'TRX-TEST-001',
    cashier_id: 'USR-01',
    cashier_name: 'Kasir Utama',
    branch_id: 'BR-01',
    items: [
      {
        product_id: '101962',
        product_name: 'PIPA AC EMERXON 1/4-3/8',
        qty: 1,
        unit: 'Roll',
        buy_price: 2500000,
        price_applied: 2750000,
        is_wholesale: false,
        subtotal_item: 2750000
      },
      {
        product_id: '102855',
        product_name: 'CAPASITOR IMA 15UF',
        qty: 2,
        unit: 'Pcs',
        buy_price: 27500,
        price_applied: 33000,
        is_wholesale: false,
        subtotal_item: 66000
      }
    ],
    subtotal: 2816000,
    discount_amount: 16000,
    tax_amount: 0,
    grand_total: 2800000,
    payment_method: 'CASH',
    cash_given: 2800000,
    change_returned: 0,
    synced: true,
    created_at: new Date().toISOString()
  };
  return await printThermalReceiptSpooler(sampleTrx, config);
}

/**
 * Universal Print Dispatcher (Dispatches to WebUSB, WebSerial, Bluetooth, or Windows/OS Thermal Spooler)
 */
export async function printReceiptUniversal(
  data: Uint8Array,
  driverType: 'USB' | 'SERIAL' | 'BLUETOOTH' | 'BROWSER' = 'USB'
): Promise<{ success: boolean; message: string }> {
  if (driverType === 'USB') {
    if ('usb' in navigator) {
      return await printToWebUSB(data);
    } else if ('serial' in navigator) {
      return await printToWebSerial(data);
    }
    return await printRawBufferViaSpooler(data);
  }

  if (driverType === 'SERIAL') {
    return await printToWebSerial(data);
  }

  if (driverType === 'BLUETOOTH') {
    return await printToWebBluetooth(data);
  }

  // Windows / OS Thermal Spooler (POS-58 / POS-80 / CUPS)
  return await printRawBufferViaSpooler(data);
}

export function generateReceiptESCPOS(transaction: Transaction, storeName = 'KETOKO POS TOKO', branchId = 'BR-01'): Uint8Array {
  const builder = new ESCPOSBuilder({ paperWidth: 58 });
  const cfg: PrinterConfig = {
    driverType: 'USB',
    paperWidth: '58mm',
    autoCut: true,
    headerText: `${storeName}\nCabang ${branchId}`,
    footerText: 'Terima kasih atas kunjungan Anda!',
    receiptStyle: 'modern',
    showLogo: false,
    logoUrl: '',
    showCashier: true,
    showQueueNumber: true,
    showDiscountSaving: true,
    showBarcodeFooter: true
  };
  return builder.buildConfiguredReceipt(transaction, cfg);
}

export async function printShiftReport(reportData: {
  cashierName: string;
  branchId: string;
  startTime: string;
  endTime: string;
  totalTransactions: number;
  grossSales: number;
  totalDiscounts: number;
  netSales: number;
  paymentSummary: {
    CASH: number;
    QRIS: number;
    DEBIT: number;
    TRANSFER?: number;
  };
  openingCash?: number;
  actualCash?: number;
  variance?: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const builder = new ESCPOSBuilder({ paperWidth: 58 });
    const opening = reportData.openingCash || 0;
    const actual = reportData.actualCash ?? (opening + reportData.paymentSummary.CASH);
    const expected = opening + reportData.paymentSummary.CASH;
    const diff = actual - expected;

    builder
      .alignCenter()
      .bold(true)
      .addLine('*** LAPORAN TUTUP SHIFT KASIR ***')
      .addLine('(Z-REPORT / SETTLEMENT)')
      .bold(false)
      .addLine(`Cabang: ${reportData.branchId}`)
      .addLine(`Kasir: ${reportData.cashierName}`)
      .addLine(`Waktu: ${new Date().toLocaleString('id-ID')}`)
      .addLine('================================')
      .alignLeft()
      .addLine(formatRow('Total Nota', `${reportData.totalTransactions} Transaksi`))
      .addLine(formatRow('Penjualan Kotor', formatRupiah(reportData.grossSales)))
      .addLine(formatRow('Total Diskon', '-' + formatRupiah(reportData.totalDiscounts)))
      .addLine('--------------------------------')
      .bold(true)
      .addLine(formatRow('PENJUALAN BERSIH', formatRupiah(reportData.netSales)))
      .bold(false)
      .addLine('--------------------------------')
      .addLine('Metode Pembayaran:')
      .addLine(formatRow(' Tunai (Cash)', formatRupiah(reportData.paymentSummary.CASH)))
      .addLine(formatRow(' QRIS Digital', formatRupiah(reportData.paymentSummary.QRIS)))
      .addLine(formatRow(' Kartu Debit', formatRupiah(reportData.paymentSummary.DEBIT)))
      .addLine(formatRow(' Transfer Bank', formatRupiah(reportData.paymentSummary.TRANSFER || 0)))
      .addLine('================================')
      .bold(true)
      .addLine('REKAPITULASI UANG KAS LACI:')
      .bold(false)
      .addLine(formatRow(' Modal Awal', formatRupiah(opening)))
      .addLine(formatRow(' + Penjualan Tunai', formatRupiah(reportData.paymentSummary.CASH)))
      .addLine(formatRow(' = Ekspektasi Laci', formatRupiah(expected)))
      .addLine(formatRow(' Uang Fisik Kasir', formatRupiah(actual)))
      .bold(true)
      .addLine(formatRow(' SELISIH KAS', (diff >= 0 ? '+' : '') + formatRupiah(diff)))
      .bold(false)
      .addLine('================================')
      .alignCenter()
      .addLine('Tanda Tangan Kasir,\n\n\n')
      .addLine(`( ${reportData.cashierName} )`)
      .addLine('Ketoko POS • Internal Shift Settlement')
      .cut(true);

    const raw = builder.getUint8Array();
    let activeDriver: 'USB' | 'SERIAL' | 'BLUETOOTH' | 'BROWSER' = 'USB';
    try {
      const saved = localStorage.getItem('ketoko_printer_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.driverType) activeDriver = parsed.driverType;
      }
    } catch {}
    return await printReceiptUniversal(raw, activeDriver);
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal cetak shift report' };
  }
}

// ══════════════════════════════════════════════════════════════════
// EPSON LX-310 DOT MATRIX / CONTINUOUS FORM SUPPORT (ESC/P 9-PIN)
// ══════════════════════════════════════════════════════════════════

export const ESCP_LX310_CMD = {
  RESET: [0x1B, 0x40],                     // ESC @ : Reset printer
  DRAFT_MODE: [0x1B, 0x78, 0x00],          // ESC x 0 : Draft mode
  CONDENSED_ON: [0x0F],                    // SI : Condensed mode (15-17 CPI)
  CONDENSED_OFF: [0x12],                   // DC2 : Normal font (10 CPI, 80 col)
  PAGE_LENGTH_33: [0x1B, 0x43, 33],        // ESC C 33 : 33 baris per halaman (Setengah Folio / Wartel 5.5 inch)
  PAGE_LENGTH_66: [0x1B, 0x43, 66],        // ESC C 66 : 66 baris per halaman (Folio Penuh 11 inch)
  BOLD_ON: [0x1B, 0x45],                   // ESC E : Bold text
  BOLD_OFF: [0x1B, 0x46],                  // ESC F : Normal text
  FORM_FEED: [0x0C]                        // FF : Lompat tepat ke batas lipatan kertas berikutnya
};

export function numberToWordsID(n: number): string {
  if (n === 0) return 'Nol Rupiah';
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  
  function terbilang(num: number): string {
    num = Math.floor(Math.abs(num));
    if (num < 12) return satuan[num];
    if (num < 20) return terbilang(num - 10) + ' Belas';
    if (num < 100) return terbilang(Math.floor(num / 10)) + ' Puluh ' + terbilang(num % 10);
    if (num < 200) return 'Seratus ' + terbilang(num - 100);
    if (num < 1000) return terbilang(Math.floor(num / 100)) + ' Ratus ' + terbilang(num % 100);
    if (num < 2000) return 'Seribu ' + terbilang(num - 1000);
    if (num < 1000000) return terbilang(Math.floor(num / 1000)) + ' Ribu ' + terbilang(num % 1000);
    if (num < 1000000000) return terbilang(Math.floor(num / 1000000)) + ' Juta ' + terbilang(num % 1000000);
    if (num < 1000000000000) return terbilang(Math.floor(num / 1000000000)) + ' Miliar ' + terbilang(num % 1000000000);
    return terbilang(Math.floor(num / 1000000000000)) + ' Triliun ' + terbilang(num % 1000000000000);
  }
  
  const res = terbilang(n).replace(/\s+/g, ' ').trim();
  return res ? res + ' Rupiah' : 'Nol Rupiah';
}

export function generateDotMatrixHTML(
  transaction: Transaction,
  config?: Partial<PrinterConfig>,
  storeProfile?: any
): string {
  const paperSize = config?.dotMatrixPaperSize || 'A4_HALF';
  const isA4Full = paperSize === 'A4_FULL';
  const isContinuousHalf = paperSize === 'CONTINUOUS_HALF';
  const isContinuousFull = paperSize === 'CONTINUOUS_FULL' || paperSize === 'FULL_CONTINUOUS';

  let pageSizeCss = '210mm 140mm';
  let pageMarginCss = '2mm 3mm';
  let minRows = 6;
  let containerMaxWidth = '185mm';

  if (isA4Full) {
    pageSizeCss = 'A4 portrait';
    pageMarginCss = '6mm 6mm';
    minRows = 11;
    containerMaxWidth = '190mm';
  } else if (isContinuousHalf) {
    pageSizeCss = '210mm 140mm';
    pageMarginCss = '2mm 3mm';
    minRows = 6;
    containerMaxWidth = '185mm';
  } else if (isContinuousFull) {
    pageSizeCss = '216mm 280mm';
    pageMarginCss = '4mm 4mm';
    minRows = 12;
    containerMaxWidth = '190mm';
  }

  // Margin kiri: default 0 mm (Rata Kiri Penuh untuk Continuous Form Epson LX-310)
  const leftMarginMm = typeof config?.dotMatrixLeftMargin === 'number' ? config.dotMatrixLeftMargin : 0;

  // Nama & Kop Usaha
  const storeName = (config?.dotMatrixStoreTitle || config?.headerText?.split('\n')[0] || storeProfile?.name || 'CV. TUMBUH MAKMUR AIR CONINDO').trim();
  const storeSub = (config?.dotMatrixStoreSub || storeProfile?.tagline || 'SPAREPART & PENDINGIN RUANGAN AC').trim();
  const storeAddr = (config?.dotMatrixStoreAddress || config?.headerText?.split('\n')[1] || storeProfile?.address || 'Jl. P Antasari No.106, Air Putih, Kec. Samarinda Ulu').trim();
  const rawStorePhone = (config?.dotMatrixStorePhone || config?.headerText?.split('\n')[2] || storeProfile?.phone || '0811 5121 215').trim();
  const cleanPhone = rawStorePhone.replace(/^(telp\s*\/\s*wa|telp|wa|hp)\s*[:\-]?\s*/i, '').trim() || rawStorePhone;

  // Catatan Bawah Faktur (Notice Retur/Garansi)
  const showNotice = config?.dotMatrixShowNotice !== false;
  const showTerbilang = config?.dotMatrixShowTerbilang !== false;
  const rawNotice = (config?.dotMatrixNotice ?? config?.footerText ?? '* Barang yang sudah dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian tertulis.\n* Klaim garansi sparepart wajib menyertakan bukti faktur resmi ini.').trim();
  const noticeLines = rawNotice
    ? rawNotice
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => (l.startsWith('*') || l.startsWith('-') ? l : `* ${l}`))
        .join('<br/>')
    : '';

  // Label Tanda Tangan
  const signerLeft = config?.dotMatrixSignerLeft || 'Tanda Terima / Pembeli';
  const signerRight = config?.dotMatrixSignerRight || 'Hormat Kami / Kasir';

  const terbilangText = numberToWordsID(transaction.grand_total);
  const totalQty = transaction.items.reduce((sum, it) => sum + it.qty, 0);
  const netSubtotal = Math.max(1, transaction.subtotal - (transaction.discount_amount || 0));
  const effectiveTaxRate = transaction.tax_amount > 0 ? Math.round((transaction.tax_amount / netSubtotal) * 100) : 0;
  const emptyRowsNeeded = Math.max(0, minRows - transaction.items.length);

  // Customer Display Name: pastikan cetak nama pelanggan asli, bukan ID / format Member #
  let custDisplayName = (transaction.customer_name || '').trim();
  if (custDisplayName.toUpperCase().startsWith('MEMBER #')) {
    custDisplayName = custDisplayName.substring(8).trim();
  }
  if (!custDisplayName && transaction.member_id) {
    custDisplayName = transaction.member_id;
  }
  if (!custDisplayName) {
    custDisplayName = 'PELANGGAN UMUM';
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Faktur Penjualan - ${transaction.receipt_number}</title>
  <style>
    @page {
      size: ${pageSizeCss};
      margin: ${pageMarginCss};
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Courier New', Courier, monospace, 'Lucida Console';
      font-size: ${isA4Full ? '12px' : '11.5px'};
      line-height: ${isA4Full ? '1.3' : '1.25'};
      color: #000000;
    }
    .faktur-container {
      width: 100%;
      max-width: ${containerMaxWidth};
      margin: 0;
      margin-left: ${leftMarginMm}mm;
      padding: 0;
      box-sizing: border-box;
    }
    .header-table, .info-table, .footer-table, .sig-table, .item-table, .summary-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      box-sizing: border-box;
    }
    .header-table td, .info-table td, .footer-table td, .sig-table td, .item-table td, .item-table th, .summary-table td {
      box-sizing: border-box;
      word-break: break-word;
      overflow-wrap: break-word;
      overflow: hidden;
    }
    .store-title {
      font-size: ${isA4Full ? '17px' : '16px'};
      font-weight: 900;
      letter-spacing: 0.5px;
      line-height: 1.15;
    }
    .store-sub {
      font-size: ${isA4Full ? '10.5px' : '11px'};
      font-weight: bold;
      color: #000000;
      margin-top: 1px;
    }
    .store-addr {
      font-size: ${isA4Full ? '11px' : '11.5px'};
      font-weight: bold;
      color: #000000;
      line-height: 1.3;
    }
    .faktur-title {
      font-size: ${isA4Full ? '18px' : '17px'};
      font-weight: 900;
      letter-spacing: 1px;
      line-height: 1.15;
    }
    .trx-info {
      font-size: ${isA4Full ? '11.5px' : '11px'};
      line-height: 1.3;
    }
    .sep-line {
      border: none;
      border-top: 1.5px dashed #000000;
      margin: ${isA4Full ? '5px 0' : '4px 0'};
    }
    .info-table td {
      font-size: ${isA4Full ? '11.5px' : '11px'};
      padding: ${isA4Full ? '2.5px 0' : '2.5px 0'};
    }
    .cust-highlight {
      font-size: ${isA4Full ? '12px' : '11.5px'};
    }
    .status-box {
      font-weight: 800;
      border-bottom: 1px dotted #000;
    }
    .item-table {
      margin: ${isA4Full ? '5px 0' : '4px 0'};
    }
    .item-table th {
      text-align: left;
      font-size: ${isA4Full ? '11.5px' : '11px'};
      padding: ${isA4Full ? '6px 3px' : '6px 3px'};
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
      font-weight: 900;
      background: #f2f2f2;
    }
    .item-table td {
      padding: ${isA4Full ? '5px 3px' : '5px 3px'};
      font-size: ${isA4Full ? '11.5px' : '11px'};
      border-bottom: 1px dotted #ddd;
    }
    .item-name {
      font-weight: 700;
      line-height: 1.25;
    }
    .empty-row td {
      height: ${isA4Full ? '24px' : '25px'};
      border-bottom: 1px dotted #e5e5e5;
    }
    .text-muted {
      color: #bbb;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: 'Courier New', Courier, monospace; }
    .font-bold { font-weight: bold; }
    .terbilang-box {
      border: 1.5px dashed #000000;
      padding: ${isA4Full ? '5px 7px' : '5px 7px'};
      background: #fafafa;
      margin-bottom: 3px;
    }
    .terbilang-label {
      font-size: ${isA4Full ? '9px' : '9px'};
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .terbilang-text {
      font-size: ${isA4Full ? '11px' : '10.5px'};
      font-style: italic;
      font-weight: 700;
      line-height: 1.3;
    }
    .notice-box {
      font-size: 9.5px;
      color: #333;
      line-height: 1.3;
      margin-top: 3px;
    }
    .summary-table td {
      font-size: ${isA4Full ? '11.5px' : '11px'};
      padding: 2px 0;
    }
    .grand-total-row td {
      font-weight: 900;
      border-top: 2px solid #000000;
      border-bottom: 2px solid #000000;
      padding: 4px 0 !important;
    }
    .grand-val {
      font-size: ${isA4Full ? '15px' : '14.5px'};
    }
    .sig-table {
      margin-top: ${isA4Full ? '16px' : '14px'};
      text-align: center;
    }
    .sig-role {
      font-size: ${isA4Full ? '11.5px' : '11px'};
      font-weight: bold;
    }
    .sig-space {
      height: ${isA4Full ? '48px' : '44px'};
    }
    .sig-line {
      font-size: ${isA4Full ? '11.5px' : '11px'};
      font-weight: bold;
    }
    @media print {
      @page {
        size: ${pageSizeCss};
        margin: ${pageMarginCss};
      }
      html, body {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .faktur-container {
        width: 100% !important;
        max-width: ${containerMaxWidth} !important;
        margin: 0 !important;
        margin-left: ${leftMarginMm}mm !important;
        padding: 0 !important;
      }
      .no-print { display: none !important; }
      tr { page-break-inside: avoid; }
      .footer-table, .sig-table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="faktur-container">
    <!-- Header Toko & Judul Faktur -->
    <table class="header-table">
      <tr>
        <td style="width: 54%; vertical-align: top;">
          <div class="store-title">${storeName.toUpperCase()}</div>
          ${storeSub ? `<div class="store-sub">${storeSub.toUpperCase()}</div>` : ''}
          <div class="store-addr">${storeAddr}</div>
          <div class="store-addr">Telp / WA: <b>${cleanPhone}</b></div>
        </td>
        <td style="width: 46%; text-align: right; vertical-align: top;">
          <div class="faktur-title">FAKTUR PENJUALAN</div>
          <div class="trx-info">No. Faktur : <b class="font-mono">${transaction.receipt_number}</b></div>
          <div class="trx-info">Tanggal    : <b>${new Date(transaction.created_at).toLocaleDateString('id-ID')} ${new Date(transaction.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</b></div>
          <div class="trx-info">Kasir      : <b>${transaction.cashier_name || 'Kasir Toko'}</b></div>
        </td>
      </tr>
    </table>

    <div class="sep-line"></div>

    <!-- Info Pelanggan & Pembayaran (Keterangan jenis kertas telah dihilangkan sesuai permintaan) -->
    <table class="info-table">
      <tr>
        <td style="width: 54%;">
          <div>Kepada Yth : <b class="cust-highlight">${custDisplayName.toUpperCase()}</b></div>
          <div>Status     : <span class="status-box">${(transaction.payment_method as string) === 'TEMPO' || (transaction.payment_method as string) === 'DEBT' ? 'KREDIT / JATUH TEMPO' : 'LUNAS / TUNAI'}</span></div>
        </td>
        <td style="width: 46%; text-align: right;">
          <div>Pembayaran : <b>${transaction.payment_method}</b></div>
        </td>
      </tr>
    </table>

    <!-- Tabel Rincian Barang -->
    <table class="item-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">NO</th>
          <th style="width: 45%;">NAMA BARANG</th>
          <th class="text-right" style="width: 10%;">QTY</th>
          <th class="text-center" style="width: 8%;">SAT</th>
          <th class="text-right" style="width: 16%;">HARGA (RP)</th>
          <th class="text-right" style="width: 16%;">TOTAL (RP)</th>
        </tr>
      </thead>
      <tbody>
        ${transaction.items.map((it, idx) => `
        <tr>
          <td class="text-center font-mono">${idx + 1}.</td>
          <td class="item-name">${it.product_name.toUpperCase()}</td>
          <td class="text-right font-mono font-bold">${it.qty}</td>
          <td class="text-center">${(it as any).unit || 'PCS'}</td>
          <td class="text-right font-mono">${formatRupiah(it.price_applied).replace('Rp ', '')}</td>
          <td class="text-right font-mono font-bold">${formatRupiah(it.subtotal_item).replace('Rp ', '')}</td>
        </tr>`).join('')}
        ${Array.from({ length: emptyRowsNeeded }).map((_, i) => `
        <tr class="empty-row">
          <td class="text-center font-mono text-muted">${transaction.items.length + i + 1}.</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="sep-line"></div>

    <!-- Total & Perhitungan -->
    <table class="footer-table">
      <tr>
        <td style="width: 52%; padding-right: 8px; vertical-align: top;">
          ${showTerbilang ? `
          <div class="terbilang-box">
            <div class="terbilang-label">TERBILANG:</div>
            <div class="terbilang-text">${terbilangText}</div>
          </div>` : ''}
          ${showNotice && noticeLines ? `
          <div class="notice-box">
            ${noticeLines}
          </div>` : ''}
        </td>
        <td style="width: 48%; vertical-align: top;">
          <table class="summary-table">
            <tr>
              <td style="width: 44%;">Total Qty / Item:</td>
              <td style="width: 56%;" class="text-right font-mono">${totalQty} Pcs (${transaction.items.length} Item)</td>
            </tr>
            <tr>
              <td style="width: 44%;">Subtotal:</td>
              <td style="width: 56%;" class="text-right font-mono">${formatRupiah(transaction.subtotal)}</td>
            </tr>
            ${transaction.discount_amount > 0 ? `
            <tr>
              <td style="width: 44%; color: #b91c1c;">Potongan Diskon:</td>
              <td style="width: 56%; color: #b91c1c;" class="text-right font-mono">-${formatRupiah(transaction.discount_amount)}</td>
            </tr>` : ''}
            ${transaction.tax_amount > 0 ? `
            <tr>
              <td style="width: 44%;">PPN (${effectiveTaxRate}%):</td>
              <td style="width: 56%;" class="text-right font-mono">${formatRupiah(transaction.tax_amount)}</td>
            </tr>` : ''}
            <tr class="grand-total-row">
              <td style="width: 44%;">TOTAL AKHIR:</td>
              <td style="width: 56%;" class="text-right font-mono grand-val">${formatRupiah(transaction.grand_total)}</td>
            </tr>
            <tr>
              <td style="width: 44%;">Bayar (${transaction.payment_method}):</td>
              <td style="width: 56%;" class="text-right font-mono">${formatRupiah(transaction.cash_given)}</td>
            </tr>
            <tr>
              <td style="width: 44%;">Kembalian:</td>
              <td style="width: 56%;" class="text-right font-mono font-bold">${formatRupiah(transaction.change_returned)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Tanda Tangan -->
    <table class="sig-table">
      <tr>
        <td style="width: 50%;">
          <div class="sig-role">${signerLeft},</div>
          <div class="sig-space"></div>
          <div class="sig-line">( .......................... )</div>
        </td>
        <td style="width: 50%;">
          <div class="sig-role">${signerRight},</div>
          <div class="sig-space"></div>
          <div class="sig-line">( ${transaction.cashier_name || 'Kasir'} )</div>
        </td>
      </tr>
    </table>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
    window.onafterprint = function() {
      setTimeout(function() {
        window.close();
      }, 500);
    };
  </script>
</body>
</html>`;
}

export async function printEpsonLX310Invoice(
  transaction: Transaction,
  config?: Partial<PrinterConfig>,
  storeProfile?: any
): Promise<{ success: boolean; message: string }> {
  try {
    let resolvedTx = { ...transaction };
    // Resolusi nama pelanggan asli dari database jika kosong atau berformat Member #...
    if (!resolvedTx.customer_name || resolvedTx.customer_name.startsWith('Member #') || resolvedTx.customer_name.startsWith('MEMBER #')) {
      const searchKey = resolvedTx.member_id || (resolvedTx.customer_name ? resolvedTx.customer_name.replace(/^Member #/i, '').trim() : '');
      if (searchKey) {
        try {
          const cust = await db.customers.get(searchKey);
          if (cust && cust.name) {
            resolvedTx.customer_name = cust.name;
          } else {
            const byCode = await db.customers.where('code').equalsIgnoreCase(searchKey).first();
            if (byCode && byCode.name) {
              resolvedTx.customer_name = byCode.name;
            }
          }
        } catch {}
      }
    }

    const html = generateDotMatrixHTML(resolvedTx, config, storeProfile);
    const printWindow = window.open('', '_blank', 'width=850,height=600');
    if (!printWindow) {
      // Fallback if popup blocked: use hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
      setTimeout(() => {
        iframe.remove();
      }, 30000);
      return { success: true, message: 'Faktur penjualan berhasil dikirim ke dialog printer!' };
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return { success: true, message: 'Jendela cetak faktur berhasil dibuka.' };
  } catch (err: any) {
    return { success: false, message: 'Gagal mencetak faktur: ' + err.message };
  }
}

