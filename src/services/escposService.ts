import type { Transaction } from '../types';
import type { PrinterConfig } from '../components/PrinterSettingsModal';

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

    if (transaction.member_id) {
      this.addLine(`Plg: Member ${transaction.member_id}`);
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
      this.addLine(formatRow('PPN (11%)', formatRupiah(transaction.tax_amount), width));
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

/**
 * Direct WebUSB Printer Driver (Linux / Chromium / Edge)
 * Supports Xprinter, Epson, POS-58, POS-80, Panda, Sunmi, VSC, Panda, Eppos
 */
export async function printToWebUSB(data: Uint8Array): Promise<{ success: boolean; message: string }> {
  try {
    if (!('usb' in navigator)) {
      return { 
        success: false, 
        message: 'WebUSB API tidak didukung browser ini. Gunakan Google Chrome atau Edge di Linux.' 
      };
    }

    // @ts-ignore
    const device: USBDevice = await navigator.usb.requestDevice({ filters: [] });
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
    if (err.name === 'SecurityError' || err.message?.includes('access denied')) {
      return { 
        success: false, 
        message: 'Izin USB Linux ditolak. Jalankan di terminal Linux: sudo chmod 666 /dev/bus/usb/*/* atau tambahkan user ke group dialout/lp.' 
      };
    }
    return { 
      success: false, 
      message: 'Gagal terhubung via WebUSB: ' + (err.message || 'Perangkat tidak merespons') 
    };
  }
}

/**
 * Web Serial API Driver (Linux /dev/ttyUSB0, /dev/ttyACM0, Windows COM)
 */
export async function printToWebSerial(data: Uint8Array, baudRate = 9600): Promise<{ success: boolean; message: string }> {
  try {
    if (!('serial' in navigator)) {
      return { 
        success: false, 
        message: 'Web Serial API tidak didukung di browser ini. Gunakan Google Chrome atau Edge.' 
      };
    }
    // @ts-ignore
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate });
    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    await port.close();
    return { success: true, message: 'Berhasil mencetak via Web Serial!' };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return { success: false, message: 'Pemilihan port serial dibatalkan.' };
    }
    return { success: false, message: err.message || 'Gagal terhubung ke Serial Printer' };
  }
}

/**
 * Web Bluetooth POS Printer Driver (BLE / ESCPOS)
 */
export async function printToWebBluetooth(data: Uint8Array): Promise<{ success: boolean; message: string }> {
  try {
    if (!('bluetooth' in navigator)) {
      return { 
        success: false, 
        message: 'Web Bluetooth API tidak didukung pada browser ini. Pastikan Bluetooth aktif di Linux.' 
      };
    }

    // @ts-ignore
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Gagal menghubungkan ke Bluetooth GATT Server');

    // Attempt to discover standard serial / printer characteristic
    const services = await server.getPrimaryServices();
    let writeChar: any = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writeChar = c;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error('Karakteristik Write Bluetooth tidak ditemukan pada printer ini');
    }

    // Send chunks (max 512 bytes per BLE packet)
    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await writeChar.writeValue(chunk);
    }

    device.gatt?.disconnect();
    return { success: true, message: `Berhasil mencetak ke ${device.name || 'Bluetooth Printer'}!` };
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return { success: false, message: 'Pemilihan Bluetooth dibatalkan.' };
    }
    return { success: false, message: err.message || 'Gagal cetak via Bluetooth' };
  }
}

/**
 * Universal Print Dispatcher (Dispatches to WebUSB, WebSerial, Bluetooth, or Browser Print)
 */
export async function printReceiptUniversal(
  data: Uint8Array,
  driverType: 'USB' | 'SERIAL' | 'BLUETOOTH' | 'BROWSER' = 'USB'
): Promise<{ success: boolean; message: string }> {
  if (driverType === 'USB') {
    // Try WebUSB first; if not supported or fallback requested, try WebSerial
    if ('usb' in navigator) {
      return await printToWebUSB(data);
    } else if ('serial' in navigator) {
      return await printToWebSerial(data);
    }
  }

  if (driverType === 'SERIAL') {
    return await printToWebSerial(data);
  }

  if (driverType === 'BLUETOOTH') {
    return await printToWebBluetooth(data);
  }

  // Browser Print Fallback
  window.print();
  return { success: true, message: 'Membuka dialog cetak browser (CUPS / Thermal Printer)' };
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
    return await printReceiptUniversal(raw, 'USB');
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
  const isA4Half = paperSize === 'A4_HALF' || paperSize === 'HALF_LETTER' || !config?.dotMatrixPaperSize;
  const isA4Full = paperSize === 'A4_FULL';
  const isContinuousHalf = paperSize === 'CONTINUOUS_HALF';
  const isContinuousFull = paperSize === 'CONTINUOUS_FULL' || paperSize === 'FULL_CONTINUOUS';

  const paperLabel = isA4Half
    ? 'A4 Di Bagi 2 (A5)'
    : isA4Full
    ? 'A4 Full (Portrait)'
    : isContinuousHalf
    ? 'Continuous Form 1/2'
    : 'Continuous Form Full';

  let pageSizeCss = '210mm 148.5mm';
  let pageMarginCss = '4mm 6mm';
  if (isA4Full) {
    pageSizeCss = 'A4 portrait';
    pageMarginCss = '8mm 10mm';
  } else if (isContinuousHalf) {
    pageSizeCss = '216mm 140mm';
    pageMarginCss = '4mm 6mm';
  } else if (isContinuousFull) {
    pageSizeCss = '216mm 280mm';
    pageMarginCss = '6mm 8mm';
  }

  const isCompact = isA4Half || isContinuousHalf;
  const storeName = storeProfile?.name || config?.headerText?.split('\n')[0] || 'CV. TUMBUH MAKMUR AIR CONINDO';
  const storeAddr = storeProfile?.address || config?.headerText?.split('\n')[1] || 'Jl. P Antasari No.106, Air Putih, Kec. Samarinda Ulu';
  const storePhone = storeProfile?.phone || config?.headerText?.split('\n')[2] || '0811 5121 215';
  
  const terbilangText = numberToWordsID(transaction.grand_total);
  const totalQty = transaction.items.reduce((sum, it) => sum + it.qty, 0);

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Faktur Penjualan (${paperLabel}) - ${transaction.receipt_number}</title>
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
    body {
      font-family: 'Courier New', Courier, monospace, 'Lucida Console';
      font-size: ${isCompact ? '10px' : '11.5px'};
      line-height: ${isCompact ? '1.2' : '1.3'};
      color: #000000;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
    }
    .faktur-container {
      width: 100%;
      max-width: ${isA4Full ? '780px' : '760px'};
      margin: 0 auto;
      padding: ${isCompact ? '2px' : '6px'};
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${isCompact ? '2px' : '4px'};
    }
    .header-table td {
      vertical-align: top;
      font-size: ${isCompact ? '10px' : '11px'};
    }
    .store-title {
      font-size: ${isCompact ? '13px' : '15px'};
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .faktur-badge {
      font-size: ${isCompact ? '13px' : '15px'};
      font-weight: 900;
      text-align: right;
      letter-spacing: 1px;
    }
    .paper-tag {
      font-size: 8.5px;
      color: #555;
      font-weight: normal;
      display: inline-block;
      border: 1px solid #999;
      border-radius: 3px;
      padding: 0 4px;
      margin-left: 4px;
    }
    .sep-line {
      border: none;
      border-top: 1px dashed #000000;
      margin: ${isCompact ? '2px 0' : '4px 0'};
    }
    .sep-double {
      border: none;
      border-top: 2px solid #000000;
      margin: ${isCompact ? '2px 0' : '4px 0'};
    }
    .item-table {
      width: 100%;
      border-collapse: collapse;
      margin: ${isCompact ? '2px 0' : '4px 0'};
    }
    .item-table th {
      text-align: left;
      font-size: ${isCompact ? '9.5px' : '11px'};
      padding: ${isCompact ? '2px 2px' : '3.5px 3px'};
      border-top: 1px solid #000000;
      border-bottom: 1px solid #000000;
      font-weight: 800;
    }
    .item-table td {
      padding: ${isCompact ? '1.5px 2px' : '3px 3px'};
      font-size: ${isCompact ? '9.5px' : '11px'};
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .footer-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: ${isCompact ? '2px' : '4px'};
    }
    .footer-table td {
      vertical-align: top;
      font-size: ${isCompact ? '9.5px' : '11px'};
    }
    .terbilang-box {
      border: 1px dashed #000000;
      padding: ${isCompact ? '2px 4px' : '4px 6px'};
      font-style: italic;
      font-size: ${isCompact ? '9px' : '10.5px'};
      margin: ${isCompact ? '2px 0' : '4px 0'};
    }
    .sig-table {
      width: 100%;
      margin-top: ${isCompact ? '4px' : '10px'};
      border-collapse: collapse;
      text-align: center;
    }
    .sig-table td {
      width: 50%;
      font-size: ${isCompact ? '9.5px' : '11px'};
    }
    .sig-space {
      height: ${isCompact ? '26px' : '46px'};
    }
    @media print {
      body { background: transparent; }
      .no-print { display: none !important; }
      .faktur-container { max-width: 100%; padding: 0; }
      tr { page-break-inside: avoid; }
      .footer-table { page-break-inside: avoid; }
      .sig-table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="faktur-container">
    <!-- Header Toko & Judul Faktur -->
    <table class="header-table">
      <tr>
        <td style="width: 58%;">
          <div class="store-title">${storeName.toUpperCase()}</div>
          <div>${storeAddr}</div>
          <div>Telp: ${storePhone}</div>
        </td>
        <td style="width: 42%; text-align: right;">
          <div class="faktur-badge">FAKTUR PENJUALAN <span class="paper-tag">${paperLabel}</span></div>
          <div>No. Faktur : <b>${transaction.receipt_number}</b></div>
          <div>Tanggal    : ${new Date(transaction.created_at).toLocaleDateString('id-ID')} ${new Date(transaction.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
        </td>
      </tr>
    </table>

    <hr class="sep-line" />

    <!-- Info Pelanggan & Kasir -->
    <table class="header-table">
      <tr>
        <td style="width: 58%;">
          <div>Kepada Yth : <b>${transaction.member_id ? `MEMBER #${transaction.member_id}` : 'PELANGGAN UMUM'}</b></div>
          <div>Status     : ${(transaction.payment_method as string) === 'TEMPO' || (transaction.payment_method as string) === 'DEBT' ? 'KREDIT / JATUH TEMPO' : 'LUNAS / TUNAI'}</div>
        </td>
        <td style="width: 42%; text-align: right;">
          <div>Kasir      : ${transaction.cashier_name || 'Kasir'}</div>
          <div>Pembayaran : ${transaction.payment_method}</div>
        </td>
      </tr>
    </table>

    <!-- Tabel Rincian Barang -->
    <table class="item-table">
      <thead>
        <tr>
          <th style="width: 5%;">NO</th>
          <th style="width: 45%;">NAMA BARANG</th>
          <th class="text-right" style="width: 10%;">QTY</th>
          <th class="text-center" style="width: 10%;">SAT</th>
          <th class="text-right" style="width: 15%;">HARGA (RP)</th>
          <th class="text-right" style="width: 15%;">TOTAL (RP)</th>
        </tr>
      </thead>
      <tbody>
        ${transaction.items.map((it, idx) => `
        <tr>
          <td>${idx + 1}.</td>
          <td>${it.product_name.toUpperCase()}</td>
          <td class="text-right">${it.qty}</td>
          <td class="text-center">${(it as any).unit || 'PCS'}</td>
          <td class="text-right">${formatRupiah(it.price_applied).replace('Rp ', '')}</td>
          <td class="text-right">${formatRupiah(it.subtotal_item).replace('Rp ', '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <hr class="sep-line" />

    <!-- Total & Perhitungan -->
    <table class="footer-table">
      <tr>
        <td style="width: 55%; padding-right: 12px;">
          <div class="terbilang-box">
            <b>Terbilang:</b> ${terbilangText}
          </div>
          <div style="font-size: 9.5px; margin-top: 4px; color: #333;">
            * Barang yang sudah dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian.
          </div>
        </td>
        <td style="width: 45%;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>Total Qty</td>
              <td class="text-right">${totalQty} Pcs (${transaction.items.length} Item)</td>
            </tr>
            <tr>
              <td>Subtotal</td>
              <td class="text-right font-mono">${formatRupiah(transaction.subtotal)}</td>
            </tr>
            ${transaction.discount_amount > 0 ? `
            <tr>
              <td>Diskon Promo</td>
              <td class="text-right font-mono text-danger">-${formatRupiah(transaction.discount_amount)}</td>
            </tr>` : ''}
            ${transaction.tax_amount > 0 ? `
            <tr>
              <td>PPN (11%)</td>
              <td class="text-right font-mono">${formatRupiah(transaction.tax_amount)}</td>
            </tr>` : ''}
            <tr style="border-top: 1px solid #000; font-weight: 800; font-size: 12px;">
              <td style="padding-top: 3px;">TOTAL AKHIR</td>
              <td class="text-right font-mono" style="padding-top: 3px;">${formatRupiah(transaction.grand_total)}</td>
            </tr>
            <tr>
              <td>Bayar (${transaction.payment_method})</td>
              <td class="text-right font-mono">${formatRupiah(transaction.cash_given)}</td>
            </tr>
            <tr>
              <td>Kembalian</td>
              <td class="text-right font-mono">${formatRupiah(transaction.change_returned)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Tanda Tangan Penerima & Hormat Kami -->
    <table class="sig-table">
      <tr>
        <td>
          <div>Tanda Terima / Pembeli,</div>
          <div class="sig-space"></div>
          <div>( ........................... )</div>
        </td>
        <td>
          <div>Hormat Kami / Kasir,</div>
          <div class="sig-space"></div>
          <div>( ${transaction.cashier_name || 'Kasir'} )</div>
        </td>
      </tr>
    </table>

    <hr class="sep-double" style="margin-top: 8px;" />
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
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
    const html = generateDotMatrixHTML(transaction, config, storeProfile);
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
      return { success: true, message: 'Faktur penjualan Epson LX-310 berhasil dikirim ke dialog printer!' };
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return { success: true, message: 'Jendela cetak faktur Epson LX-310 berhasil dibuka.' };
  } catch (err: any) {
    return { success: false, message: 'Gagal mencetak faktur LX-310: ' + err.message };
  }
}

