/**
 * Professional Client-Side PDF Report Generator for Ketoko POS
 * Generates formatted A4 documents with official Kop Surat, KPI metrics,
 * structured data tables, and signature blocks.
 */

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

export function exportReportToPDF(options: PDFReportOptions) {
  const storeName = options.storeProfile?.name || 'KETOKO POS';
  const branchName = options.storeProfile?.branch_name || 'Cabang Samarinda (BR-01)';
  const storeAddress = options.storeProfile?.address || 'Jl. Pahlawan No. 45, Samarinda';
  const storePhone = options.storeProfile?.phone || '0812-3456-7890';
  const storeNpwp = options.storeProfile?.npwp || '01.234.567.8-721.000';
  const logo = options.storeProfile?.logo_base64;

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
      background: #7c4e2f;
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
      color: #7c4e2f;
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
      background: #fdfaf7;
      border-color: #ddc3aa;
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
      color: #7c4e2f;
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
        <div class="branch">${branchName}</div>
        <div class="address">${storeAddress} • Telp: ${storePhone} ${storeNpwp ? `• NPWP: ${storeNpwp}` : ''}</div>
      </div>
    </div>
    <div class="report-meta">
      <div class="report-badge">Dokumen Resmi Retail</div>
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
