/**
 * Professional Client-Side PDF Report Generator for Ketoko POS
 * Generates formatted A4 documents with official Kop Surat, KPI metrics,
 * structured data tables, and signature blocks.
 */

import { resolveStoreFromCurrentHost } from './storeRegistry';

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  periodText?: string;
  storeProfile?: {
    name: string;
    branch_name?: string;
    address?: string;
    phone?: string;
    npwp?: string;
    logo_base64?: string;
  };
  kpis?: Array<{
    label: string;
    value: string;
    sublabel?: string;
    highlight?: boolean;
  }>;
  table: {
    headers: string[];
    rows: Array<Array<string | number>>;
    alignments?: Array<'left' | 'center' | 'right'>;
    footers?: string[];
  };
  notes?: string;
  signatures?: Array<{
    title: string;
    name: string;
  }>;
}

function sanitizeReportAddress(addr?: string, branchName?: string): string {
  const trimmed = (addr || '').trim();
  if (!trimmed || trimmed === '-') return '';
  if (/jl\.?\s*pahlawan/i.test(trimmed)) return '';
  if (branchName && trimmed.toLowerCase() === branchName.trim().toLowerCase()) return '';
  return trimmed;
}

function sanitizeReportPhone(phone?: string): string {
  const trimmed = (phone || '').trim();
  if (!trimmed || trimmed === '-' || trimmed === '0812-3456-7890' || trimmed === '08123456789') {
    return '';
  }
  return trimmed;
}

export function exportReportToPDF(options: PDFReportOptions) {
  const hostStore = resolveStoreFromCurrentHost();
  let savedProfile: Partial<NonNullable<PDFReportOptions['storeProfile']>> = {};
  try {
    const rawSaved = typeof window !== 'undefined' ? localStorage.getItem('ketoko_store_profile') : null;
    if (rawSaved) savedProfile = JSON.parse(rawSaved);
  } catch {}

  const storeName =
    options.storeProfile?.name ||
    savedProfile.name ||
    hostStore.name ||
    'KETOKO POS';
  const branchName =
    options.storeProfile?.branch_name ||
    savedProfile.branch_name ||
    hostStore.branch ||
    '';
  const storeAddress = sanitizeReportAddress(
    options.storeProfile?.address ?? savedProfile.address,
    branchName
  );
  const storePhone = sanitizeReportPhone(
    options.storeProfile?.phone ?? savedProfile.phone ?? hostStore.phone
  );
  const logo = options.storeProfile?.logo_base64 || savedProfile.logo_base64;

  const isKoperasi =
    hostStore.id.startsWith('store-koperasimsl') || /koperasi/i.test(storeName);
  const accentColor = isKoperasi ? '#065f46' : '#0f766e';
  const accentBg = isKoperasi ? '#ecfdf5' : '#f0fdfa';
  const accentBorder = isKoperasi ? '#a7f3d0' : '#99f6e4';
  const badgeLabel = isKoperasi ? 'Dokumen Resmi Koperasi' : 'Dokumen Resmi Toko';

  const contactParts: string[] = [];
  if (storeAddress) contactParts.push(storeAddress);
  if (storePhone) contactParts.push(`Telp: ${storePhone}`);
  const contactLine = contactParts.join(' • ');

  const alignments = options.table.alignments || options.table.headers.map((_, i) => (i === 0 ? 'center' : i >= options.table.headers.length - 3 ? 'right' : 'left'));

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${options.title} - ${storeName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 10px;
      font-size: 11px;
      line-height: 1.4;
    }
    /* Header Kop Surat */
    .header-kop {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #334155;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .store-logo {
      width: 56px;
      height: 56px;
      object-fit: contain;
      border-radius: 8px;
    }
    .store-logo-placeholder {
      width: 50px;
      height: 50px;
      background: ${accentColor};
      color: #ffffff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 20px;
    }
    .store-info h1 {
      margin: 0 0 2px 0;
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .store-info .branch {
      font-size: 12px;
      font-weight: 700;
      color: ${accentColor};
      margin-bottom: 2px;
    }
    .store-info .address {
      font-size: 10px;
      color: #64748b;
    }
    .report-meta {
      text-align: right;
    }
    .report-badge {
      display: inline-block;
      padding: 3px 8px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-weight: 800;
      font-size: 9px;
      text-transform: uppercase;
      color: #334155;
      margin-bottom: 4px;
    }
    .report-date {
      font-size: 10px;
      color: #64748b;
    }
    /* Title Section */
    .title-bar {
      text-align: center;
      margin-bottom: 16px;
      padding: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .title-bar h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.5px;
    }
    .title-bar .subtitle {
      font-size: 10.5px;
      color: #475569;
      font-weight: 600;
      margin-top: 2px;
    }
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(${options.kpis ? Math.min(options.kpis.length, 4) : 4}, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .kpi-card.highlight {
      background: ${accentBg};
      border-color: ${accentBorder};
    }
    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 3px;
    }
    .kpi-value {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      font-family: monospace, sans-serif;
    }
    .kpi-card.highlight .kpi-value {
      color: ${accentColor};
    }
    .kpi-sub {
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 2px;
    }
    /* Table Styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10px;
    }
    th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      letter-spacing: 0.3px;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .t-left { text-align: left; }
    .t-center { text-align: center; }
    .t-right { text-align: right; font-family: monospace, sans-serif; }
    .footer-row td {
      background-color: #e2e8f0 !important;
      font-weight: 900;
      color: #0f172a;
      border-top: 2px solid #334155;
    }
    /* Signature Block */
    .signature-container {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 200px;
      text-align: center;
      font-size: 10px;
    }
    .sig-line {
      margin-top: 48px;
      border-bottom: 1px solid #334155;
      margin-bottom: 4px;
    }
    .sig-title {
      font-weight: 700;
      color: #64748b;
    }
    .sig-name {
      font-weight: 800;
      color: #0f172a;
    }
    /* Print Footer */
    .doc-footer {
      margin-top: 20px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      font-size: 8.5px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- 1. Kop Surat Toko -->
  <div class="header-kop">
    <div class="header-left">
      ${logo ? `<img src="${logo}" alt="Logo" class="store-logo" />` : `<div class="store-logo-placeholder">${storeName.charAt(0)}</div>`}
      <div class="store-info">
        <h1>${storeName}</h1>
        ${branchName ? `<div class="branch">${branchName}</div>` : ''}
        ${contactLine ? `<div class="address">${contactLine}</div>` : ''}
      </div>
    </div>
    <div class="report-meta">
      <div class="report-badge">${badgeLabel}</div>
      <div class="report-date">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
    </div>
  </div>

  <!-- 2. Judul & Periode Laporan -->
  <div class="title-bar">
    <h2>${options.title}</h2>
    ${options.periodText ? `<div class="subtitle">Periode Data: ${options.periodText}</div>` : ''}
    ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
  </div>

  <!-- 3. Ringkasan Eksekutif (KPIs) -->
  ${options.kpis && options.kpis.length > 0 ? `
    <div class="kpi-grid">
      ${options.kpis.map((k) => `
        <div class="kpi-card ${k.highlight ? 'highlight' : ''}">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.value}</div>
          ${k.sublabel ? `<div class="kpi-sub">${k.sublabel}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : ''}

  <!-- 4. Tabel Data Rinci -->
  <table>
    <thead>
      <tr>
        ${options.table.headers.map((h, i) => `<th class="t-${alignments[i] || 'left'}">${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${options.table.rows.map((row) => `
        <tr>
          ${row.map((cell, i) => `<td class="t-${alignments[i] || 'left'}">${cell}</td>`).join('')}
        </tr>
      `).join('')}
      ${options.table.footers ? `
        <tr class="footer-row">
          ${options.table.footers.map((f, i) => `<td class="t-${alignments[i] || 'left'}">${f}</td>`).join('')}
        </tr>
      ` : ''}
    </tbody>
  </table>

  <!-- 5. Catatan / Kebijakan -->
  ${options.notes ? `<div style="font-size: 9px; color: #64748b; margin-top: 8px; font-style: italic;">* ${options.notes}</div>` : ''}

  <!-- 6. Kolom Tanda Tangan -->
  <div class="signature-container">
    <div class="sig-box">
      <div class="sig-title">Dibuat / Dicetak Oleh:</div>
      <div class="sig-line"></div>
      <div class="sig-name">( Kasir / Operator POS )</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Disetujui / Diperiksa:</div>
      <div class="sig-line"></div>
      <div class="sig-name">( Kepala Toko / Owner )</div>
    </div>
  </div>

  <!-- 7. Dokumen Footer -->
  <div class="doc-footer">
    <span>Ketoko POS Engine v2.0 • Sistem Kasir Pintar & Akuntansi Retail</span>
    <span>Halaman 1 / 1 (Official Export)</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>
  `;

  // Open formatted print window for instant PDF Save / Print
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    // If pop-up blocked, fallback to iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
  }
}

export interface ExcelReportOptions extends PDFReportOptions {
  filename?: string;
  sheetName?: string;
  columnWidths?: number[];
}

/**
 * Ekspor Laporan ke File Microsoft Excel (.xls) Rapi Berwarna
 * Desain seragam dengan Laporan A4 Koperasi (Header Tengah, Kartu KPI, Tabel Berkolom Rapi & Baris Total)
 */
export function exportReportToExcel(options: ExcelReportOptions): void {
  const esc = (v: any) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const hostStore = resolveStoreFromCurrentHost();
  let savedProfile: Partial<NonNullable<PDFReportOptions['storeProfile']>> = {};
  try {
    const rawSaved = typeof window !== 'undefined' ? localStorage.getItem('ketoko_store_profile') : null;
    if (rawSaved) savedProfile = JSON.parse(rawSaved);
  } catch {}

  const rawStoreName =
    options.storeProfile?.name ||
    savedProfile.name ||
    hostStore.name ||
    'KETOKO POS';
  const storeName =
    !rawStoreName || rawStoreName.toUpperCase() === 'KETOKO POS'
      ? (hostStore.name || 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI').toUpperCase()
      : rawStoreName.toUpperCase();
  const branchName =
    options.storeProfile?.branch_name ||
    savedProfile.branch_name ||
    hostStore.branch ||
    '';

  const headers = options.table.headers;
  const colCount = Math.max(headers.length, 4);
  const alignments =
    options.table.alignments ||
    headers.map((_, i) => (i === 0 ? 'center' : i >= headers.length - 3 ? 'right' : 'left'));
  const colWidths =
    options.columnWidths ||
    headers.map((h, i) => {
      if (i === 0 && /^no\.?$/i.test(h.trim())) return 45;
      if (/rincian|barang|nama|deskripsi|komponen/i.test(h)) return 320;
      if (/pelanggan|karyawan|kasir|kategori/i.test(h)) return 190;
      if (/waktu|tanggal|nota|sku|kode/i.test(h)) return 150;
      return 130;
    });

  const kpis = options.kpis || [];
  let kpiHtml = '';
  if (kpis.length > 0) {
    const baseSpan = Math.max(1, Math.floor(colCount / kpis.length));
    const spans = kpis.map((_, idx) =>
      idx === kpis.length - 1 ? Math.max(1, colCount - baseSpan * (kpis.length - 1)) : baseSpan
    );
    kpiHtml = `
  <tr>
    ${kpis.map((k, i) => `<td colspan="${spans[i]}" class="kpi-lbl">${esc(k.label)}</td>`).join('')}
  </tr>
  <tr>
    ${kpis
      .map(
        (k, i) =>
          `<td colspan="${spans[i]}" class="kpi-val" style="color:${k.highlight ? '#047857' : '#0f172a'};">${esc(k.value)}${k.sublabel ? `<br/><span style="font-size:8.5pt;font-weight:normal;color:#64748b;">${esc(k.sublabel)}</span>` : ''}</td>`
      )
      .join('')}
  </tr>
  <tr><td colspan="${colCount}" style="border:none;height:10px;padding:0;"></td></tr>`;
  }

  const rowsHtml = options.table.rows
    .map((row, rIdx) => {
      const bg = rIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
      return `
  <tr>
    ${row
      .map((cell, cIdx) => {
        const align = alignments[cIdx] || 'left';
        const str = String(cell ?? '');
        const isLastCol = cIdx === row.length - 1;
        const isNeg = str.trim().startsWith('-Rp') || (str.trim().startsWith('-') && str.trim().length > 1);
        const color = isNeg ? '#b91c1c' : isLastCol && align === 'right' ? '#047857' : '#1f2937';
        const weight = cIdx === 1 || (isLastCol && align === 'right') ? 'bold' : 'normal';
        return `<td style="background:${bg};text-align:${align};color:${color};font-weight:${weight};mso-number-format:'\\@';">${esc(str)}</td>`;
      })
      .join('')}
  </tr>`;
    })
    .join('');

  const footerHtml = options.table.footers
    ? `
  <tr>
    ${options.table.footers
      .map((f, cIdx) => {
        const align = alignments[cIdx] || 'left';
        return `<td class="tot-td" style="text-align:${align};">${esc(f)}</td>`;
      })
      .join('')}
  </tr>`
    : '';

  const sheetTitle = (options.sheetName || options.title || 'Laporan')
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31);

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${esc(sheetTitle)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10pt; color: #1f2937; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 6px 8px; vertical-align: middle; border: 0.5pt solid #e2e8f0; mso-number-format:"\\@"; }
  br { mso-data-placement: same-cell; }
  .hdr-title { font-size: 15pt; font-weight: bold; color: #064e3b; text-align: center; border: none; padding: 6px 0 2px 0; }
  .hdr-branch { font-size: 10pt; font-weight: bold; color: #047857; text-align: center; border: none; padding: 1px 0; }
  .hdr-sub { font-size: 11.5pt; font-weight: bold; color: #334155; text-align: center; border: none; padding: 3px 0; }
  .hdr-period { font-size: 10pt; font-weight: bold; color: #047857; text-align: center; border-top: none; border-left: none; border-right: none; border-bottom: 2pt solid #047857; padding: 2px 0 10px 0; }
  .kpi-lbl { background: #f8faf9; border-top: 1pt solid #d1fae5; border-left: 1pt solid #d1fae5; border-right: 1pt solid #d1fae5; border-bottom: none; font-size: 8.5pt; font-weight: bold; color: #065f46; text-align: center; text-transform: uppercase; padding: 8px 6px 2px 6px; }
  .kpi-val { background: #f8faf9; border-bottom: 1pt solid #d1fae5; border-left: 1pt solid #d1fae5; border-right: 1pt solid #d1fae5; border-top: none; font-size: 12pt; font-weight: bold; color: #0f172a; text-align: center; padding: 2px 6px 8px 6px; }
  .tbl-th { background: #064e3b; color: #ffffff; font-weight: bold; font-size: 10pt; border: 0.5pt solid #064e3b; height: 32px; }
  .tot-td { background: #ecfdf5; font-weight: bold; font-size: 10.5pt; color: #064e3b; border-top: 1.5pt solid #047857; border-bottom: 1.5pt solid #047857; padding: 8px; }
</style>
</head>
<body>
<table>
  <colgroup>${colWidths.map((w) => `<col width="${w}" style="width:${w}px">`).join('')}</colgroup>
  <tr><td colspan="${colCount}" class="hdr-title">${esc(storeName)}</td></tr>
  ${branchName ? `<tr><td colspan="${colCount}" class="hdr-branch">${esc(branchName)}</td></tr>` : ''}
  <tr><td colspan="${colCount}" class="hdr-sub">${esc(options.title)}</td></tr>
  <tr><td colspan="${colCount}" class="hdr-period">${esc(options.periodText ? `Periode: ${options.periodText}` : `Dicetak: ${new Date().toLocaleString('id-ID')}`)}</td></tr>
  <tr><td colspan="${colCount}" style="border:none;height:10px;padding:0;"></td></tr>
  ${kpiHtml}
  <tr>
    ${headers.map((h, i) => `<th class="tbl-th" style="text-align:${alignments[i] || 'left'};">${esc(h)}</th>`).join('')}
  </tr>
  ${rowsHtml}
  ${footerHtml}
</table>
</body>
</html>`;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileBase = options.filename || `Laporan_${sheetTitle.replace(/\s+/g, '_')}_${dateStr}`;
  const finalFilename = fileBase.endsWith('.xls') ? fileBase : `${fileBase}.xls`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', finalFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
