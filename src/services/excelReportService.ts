/**
 * Professional Excel (.xls) and CSV Exporter for Ketoko POS
 * Specially formatted to support Customer & Item Sales Report with grouped subtotal rows
 */

export interface CustomerItemRowData {
  product_id?: string;
  product_name: string;
  modal: number; // Harga Pokok / Modal total (buy_price * qty)
  unit_modal: number;
  qty: number;
  unit_price: number;
  sales: number; // Penjualan total (qty * unit_price)
  profit: number;
}

export interface CustomerReportGroupData {
  customer_name: string;
  items: CustomerItemRowData[];
  total_modal: number;
  total_qty: number;
  total_sales: number;
  total_profit: number;
}

export interface ExportCustomerItemsOptions {
  storeName?: string;
  branchName?: string;
  periodText: string;
  generatedAt?: string;
  groups: CustomerReportGroupData[];
  grandTotals: {
    modal: number;
    qty: number;
    sales: number;
    profit: number;
  };
}

/**
 * Format number to Indonesian thousands separator (e.g. 10.000)
 */
function formatNumber(num: number): string {
  return (num || 0).toLocaleString('id-ID');
}

/**
 * Export Customer & Item Sales Report to native Excel HTML format (.xls)
 * Compatible with MS Excel, LibreOffice Calc, WPS Office, and Google Sheets.
 */
export function exportCustomerItemsToExcel(options: ExportCustomerItemsOptions): void {
  const storeName = options.storeName || 'KETOKO POS';
  const branchName = options.branchName || 'Cabang Utama';
  const periodText = options.periodText;
  const generatedAt = options.generatedAt || new Date().toLocaleString('id-ID');

  let rowsHtml = '';

  options.groups.forEach((group) => {
    const itemCount = group.items.length;
    group.items.forEach((item, idx) => {
      const isFirst = idx === 0;
      rowsHtml += `
      <tr>
        ${isFirst ? `<td rowspan="${itemCount + 1}" style="vertical-align: top; font-weight: bold; background-color: #f8fafc;">${group.customer_name}</td>` : ''}
        <td>${item.product_name}</td>
        <td class="text-right num">${item.modal > 0 ? formatNumber(item.modal) : ''}</td>
        <td class="text-center num">${formatNumber(item.qty)}</td>
        <td class="text-right num">${item.unit_price > 0 ? formatNumber(item.unit_price) : ''}</td>
        <td class="text-right num">${formatNumber(item.sales)}</td>
      </tr>
      `;
    });

    // Subtotal Row for this Customer (Light Blue background #cbe4fc matching the user's reference)
    rowsHtml += `
    <tr class="total-row" style="background-color: #cbe4fc; font-weight: bold;">
      <td style="font-weight: bold; color: #1e3a8a;">Total Nama Barang</td>
      <td class="text-right num" style="color: #be185d;">${group.total_modal > 0 ? formatNumber(group.total_modal) : ''}</td>
      <td class="text-center num" style="color: #1e3a8a;">${formatNumber(group.total_qty)}</td>
      <td class="text-center">-</td>
      <td class="text-right num" style="color: #1e3a8a;">${formatNumber(group.total_sales)}</td>
    </tr>
    `;
  });

  // Grand Total Row
  const grandTotalRow = `
  <tr class="grand-total-row" style="background-color: #93c5fd; font-weight: bold; font-size: 12pt;">
    <td colspan="2" style="font-weight: bold; color: #0f172a;">GRAND TOTAL SEMUA PELANGGAN (${options.groups.length} Pelanggan)</td>
    <td class="text-right num" style="color: #be185d;">${formatNumber(options.grandTotals.modal)}</td>
    <td class="text-center num">${formatNumber(options.grandTotals.qty)}</td>
    <td class="text-center">-</td>
    <td class="text-right num" style="color: #0f172a;">${formatNumber(options.grandTotals.sales)}</td>
  </tr>
  `;

  const excelHtml = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=utf-8" />
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>Laporan Pelanggan</x:Name>
            <x:WorksheetOptions>
              <x:DisplayGridlines/>
            </x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
      .header-title { font-size: 14pt; font-weight: bold; color: #1e3a8a; }
      .header-period { font-size: 11pt; font-weight: bold; color: #dc2626; margin-bottom: 8px; }
      .header-meta { font-size: 9pt; color: #64748b; font-style: italic; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; }
      th { 
        background-color: #cbe4fc; 
        color: #0f172a; 
        border: 1px solid #475569; 
        padding: 8px 10px; 
        font-weight: bold; 
        font-size: 11pt; 
      }
      th.modal-col { color: #be185d; }
      td { 
        border: 1px solid #94a3b8; 
        padding: 6px 10px; 
        font-size: 10.5pt; 
      }
      .total-row td { 
        background-color: #cbe4fc; 
        border-top: 1px solid #3b82f6; 
        border-bottom: 2px solid #3b82f6; 
        font-weight: bold; 
      }
      .grand-total-row td { 
        background-color: #93c5fd; 
        border-top: 2px solid #1d4ed8; 
        border-bottom: 2px solid #1d4ed8; 
        font-weight: bold; 
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .num { mso-number-format:"\\#\\,\\#\\#0"; }
    </style>
  </head>
  <body>
    <div class="header-title">${storeName} - ${branchName}</div>
    <div style="font-size: 12pt; font-weight: bold; color: #334155;">LAPORAN PENJUALAN PER PELANGGAN & BARANG</div>
    <div class="header-period">${periodText}</div>
    <div class="header-meta">Dicetak pada: ${generatedAt} &bull; Sistem POS Resmi Ketoko POS</div>
    <br/>
    <table>
      <thead>
        <tr>
          <th style="width: 180px; text-align: left;">Pelanggan</th>
          <th style="width: 320px; text-align: left;">Nama Barang</th>
          <th class="modal-col" style="width: 120px; text-align: right;">Modal</th>
          <th style="width: 90px; text-align: center;">Kuantitas</th>
          <th style="width: 120px; text-align: right;">Harga Satuan</th>
          <th style="width: 140px; text-align: right;">Penjualan</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        ${grandTotalRow}
      </tbody>
    </table>
  </body>
  </html>
  `;

  const blob = new Blob(['\uFEFF' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Laporan_Pelanggan_Barang_${dateStr}.xls`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Customer & Item Sales Report to standard CSV format (.csv)
 */
export function exportCustomerItemsToCSV(options: ExportCustomerItemsOptions): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Laporan_Pelanggan_Barang_${dateStr}.csv`;

  const escapeCSV = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

  let csv = '\uFEFF';
  csv += `${escapeCSV(options.storeName || 'KETOKO POS')} - LAPORAN PENJUALAN PER PELANGGAN & BARANG\n`;
  csv += `Periode: ${escapeCSV(options.periodText)}\n\n`;
  csv += 'Pelanggan,Nama Barang,Modal,Kuantitas,Harga Satuan,Penjualan\n';

  options.groups.forEach((group) => {
    group.items.forEach((it) => {
      csv += `${escapeCSV(group.customer_name)},${escapeCSV(it.product_name)},${it.modal || 0},${it.qty || 0},${it.unit_price || 0},${it.sales || 0}\n`;
    });
    // Subtotal row
    csv += `${escapeCSV(group.customer_name)},"Total Nama Barang",${group.total_modal || 0},${group.total_qty || 0},0,${group.total_sales || 0}\n`;
  });

  // Grand total row
  csv += `"GRAND TOTAL",${escapeCSV(`Semua ${options.groups.length} Pelanggan`)},${options.grandTotals.modal || 0},${options.grandTotals.qty || 0},0,${options.grandTotals.sales || 0}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
