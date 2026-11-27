import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Share2, 
  Copy, 
  Check, 
  FileText, 
  Phone, 
  MapPin, 
  CreditCard, 
  ExternalLink
} from 'lucide-react';
import type { Transaction, Customer, StoreProfile } from '../types';
import { formatRupiah, numberToWordsID } from '../services/escposService';
import { formatCustomerAddressDisplay } from '../utils/customerAccess';
import { db } from '../db';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  storeProfile?: StoreProfile | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  transaction,
  storeProfile: propStoreProfile
}) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [copied, setCopied] = useState(false);
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(() => {
    if (propStoreProfile) return propStoreProfile;
    try {
      const saved = localStorage.getItem('ketoko_store_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: 'CV. TUMBUH MAKMUR AIR CONINDO',
      branch_name: 'Cabang Samarinda (BR-01)',
      tagline: 'Pusat Sparepart AC, Pipa Tembaga, Freon & Komponen Pendingin',
      address: 'Jl. Pahlawan No. 45, Samarinda, Kalimantan Timur',
      phone: '0812-3456-7890',
      npwp: '01.234.567.8-721.000',
      footer_message: 'Barang yang sudah dibeli dapat ditukar maksimal 2x24 jam dengan membawa faktur resmi ini.'
    } as StoreProfile;
  });

  // Load Customer detail from Dexie if available
  useEffect(() => {
    if (isOpen && transaction) {
      const fetchCust = async () => {
        try {
          if (transaction.member_id) {
            const byId = await db.customers.get(transaction.member_id);
            if (byId) {
              setCustomer(byId);
              return;
            }
            const byCode = await db.customers.where('code').equalsIgnoreCase(transaction.member_id).first();
            if (byCode) {
              setCustomer(byCode);
              return;
            }
          }
          if (transaction.customer_name && transaction.customer_name !== 'PELANGGAN UMUM') {
            const byName = await db.customers.where('name').equalsIgnoreCase(transaction.customer_name).first();
            if (byName) {
              setCustomer(byName);
              return;
            }
          }
          setCustomer(null);
        } catch {
          setCustomer(null);
        }
      };
      fetchCust();

      if (!propStoreProfile) {
        try {
          const saved = localStorage.getItem('ketoko_store_profile');
          if (saved) setStoreProfile(JSON.parse(saved));
        } catch {}
      }
    }
  }, [isOpen, transaction, propStoreProfile]);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const isLunas = transaction.payment_method !== 'TEMPO';
  const grandTotal = transaction.grand_total || 0;
  const cashGiven = transaction.cash_given || grandTotal;
  const changeReturned = transaction.change_returned || 0;
  const terbilangText = numberToWordsID(grandTotal);

  // Format tanggal rapi Indonesia
  const txDate = new Date(transaction.created_at);
  const formattedDate = txDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formattedTime = txDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const dueDateFormatted = transaction.due_date 
    ? new Date(transaction.due_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '-';

  const custName = customer?.name || transaction.customer_name || 'Pelanggan Umum';
  const custPhone = customer?.phone || '-';
  const custAddress = formatCustomerAddressDisplay(customer?.address);
  const custCode = customer?.code || transaction.member_id || '-';

  // Handle Print via Window Print (A4 Format)
  const handlePrint = () => {
    window.print();
  };

  // Open dedicated standalone clean print window (for direct PDF save / print dialog)
  const handleOpenPrintWindow = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) {
      window.print();
      return;
    }

    const printContent = document.getElementById('printable-invoice-sheet')?.innerHTML || '';
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Faktur Penjualan - ${transaction.receipt_number}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            background: #fff;
            color: #1c1917;
            font-size: 11px;
            line-height: 1.4;
            padding: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 6px 8px;
            font-size: 10.5px;
          }
          th {
            background-color: #f5f5f4;
            border-top: 1.5px solid #444;
            border-bottom: 1.5px solid #444;
            font-weight: 700;
          }
          td {
            border-bottom: 1px solid #e7e5e4;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: 700; }
          .font-mono { font-family: monospace; }
          .border-b-double { border-bottom: 3px double #333; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Kirim Invoice via WhatsApp
  const handleShareWhatsApp = () => {
    let text = `*FAKTUR PENJUALAN - ${storeProfile.name || 'CV. TUMBUH MAKMUR AIR CONINDO'}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*No. Faktur :* ${transaction.receipt_number}\n`;
    text += `*Tanggal    :* ${formattedDate} (${formattedTime})\n`;
    text += `*Pelanggan  :* ${custName}\n`;
    if (custPhone !== '-') text += `*No. HP     :* ${custPhone}\n`;
    text += `*Status     :* ${isLunas ? 'LUNAS' : 'TEMPO / BELUM LUNAS'}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*RINCIAN BARANG:*\n`;
    transaction.items.forEach((it, idx) => {
      text += `${idx + 1}. ${it.product_name}\n`;
      text += `   ${it.qty} ${it.unit || 'Pcs'} x ${formatRupiah(it.price_applied)} = ${formatRupiah(it.subtotal_item)}\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Subtotal   :* ${formatRupiah(transaction.subtotal)}\n`;
    if (transaction.discount_amount > 0) text += `*Diskon     :* -${formatRupiah(transaction.discount_amount)}\n`;
    if (transaction.tax_amount > 0) text += `*PPN 11%    :* ${formatRupiah(transaction.tax_amount)}\n`;
    text += `*GRAND TOTAL:* *${formatRupiah(grandTotal)}*\n`;
    text += `*Terbilang  :* _${terbilangText}_\n`;
    text += `*Metode Bayar:* ${transaction.payment_method}\n`;
    if (transaction.payment_method === 'CASH') {
      text += `*Uang Tunai :* ${formatRupiah(cashGiven)}\n`;
      text += `*Kembalian  :* ${formatRupiah(changeReturned)}\n`;
    } else if (transaction.payment_method === 'TEMPO') {
      text += `*Uang Muka  :* ${formatRupiah(cashGiven)}\n`;
      text += `*Sisa Tagihan:* ${formatRupiah(Math.max(0, grandTotal - cashGiven))}\n`;
      if (transaction.due_date) text += `*Jatuh Tempo:* ${dueDateFormatted}\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `_Terima kasih atas kepercayaan Anda berbelanja di ${storeProfile.name || 'CV. Tumbuh Makmur Air Conindo'}._`;

    const cleanPhone = custPhone.replace(/\D/g, '');
    let waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (cleanPhone.length >= 9) {
      const targetPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
      waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
    }
    window.open(waUrl, '_blank');
  };

  // Salin Rincian Faktur ke Clipboard
  const handleCopyText = () => {
    let text = `FAKTUR PENJUALAN - ${storeProfile.name}\n`;
    text += `No. Faktur: ${transaction.receipt_number}\n`;
    text += `Tanggal: ${formattedDate}\n`;
    text += `Pelanggan: ${custName}\n`;
    text += `Total: ${formatRupiah(grandTotal)}\n`;
    text += `Status: ${isLunas ? 'LUNAS' : 'TEMPO'}\n`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#fcf9f5] flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      {/* Print-specific style injection to guarantee only invoice sheet prints */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice-sheet, #printable-invoice-sheet * {
            visibility: visible;
          }
          #printable-invoice-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-[#fcf9f5] w-full h-full flex flex-col overflow-hidden">
        
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print px-4 sm:px-6 lg:px-8 py-4 bg-gradient-to-r from-[#6f4021] via-[#85532f] to-[#9b663b] text-white flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm border-b border-[#5e3519]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-2xl bg-white/10 text-amber-200 border border-white/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base leading-tight">Faktur Penjualan / Invoice Pelanggan</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  isLunas ? 'bg-emerald-800 text-emerald-100 border border-emerald-500/40' : 'bg-amber-800 text-amber-100 border border-amber-500/40'
                }`}>
                  {isLunas ? 'LUNAS' : 'TEMPO'}
                </span>
              </div>
              <p className="text-xs text-[#fcefe3]/90 font-mono mt-0.5">
                {transaction.receipt_number} • {formattedDate}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Tombol Cetak Langsung (Browser Print) */}
            <button
              onClick={handlePrint}
              type="button"
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
              title="Cetak Faktur A4 menggunakan dialog printer"
            >
              <Printer className="w-4 h-4 text-emerald-200" />
              <span>Cetak Faktur</span>
            </button>

            {/* Tombol Buka Tab Cetak Baru / Simpan PDF */}
            <button
              onClick={handleOpenPrintWindow}
              type="button"
              className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors border border-white/20"
              title="Buka Faktur di Jendela Baru / Simpan ke PDF"
            >
              <ExternalLink className="w-4 h-4 text-amber-200" />
              <span className="hidden sm:inline">PDF / Tab Baru</span>
            </button>

            {/* Tombol Kirim WhatsApp */}
            <button
              onClick={handleShareWhatsApp}
              type="button"
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-2xs"
              title="Kirim rincian faktur ke nomor WhatsApp Pelanggan"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            {/* Tombol Salin */}
            <button
              onClick={handleCopyText}
              type="button"
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              title="Salin Rincian Faktur"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Tombol Tutup */}
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl text-[#fcefe3] hover:text-white hover:bg-white/10 transition-colors ml-1"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-stone-100 flex-1 flex justify-center">
          
          {/* Printable Sheet (Standard A4 Paper Container) */}
          <div 
            id="printable-invoice-sheet"
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-stone-900 p-8 sm:p-10 shadow-lg rounded-xl border border-stone-200 flex flex-col justify-between"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <div>
              {/* 1. KOP SURAT TOKO */}
              <div className="pb-4 border-b-2 border-stone-800 flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight uppercase leading-none">
                    {storeProfile.name || 'CV. TUMBUH MAKMUR AIR CONINDO'}
                  </h1>
                  <p className="text-xs font-semibold text-stone-600 mt-1">
                    {storeProfile.tagline || 'Spesialis Sparepart AC, Pipa Tembaga, Freon & Komponen Pendingin'}
                  </p>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {storeProfile.address || 'Jl. Pahlawan No. 45, Samarinda, Kalimantan Timur'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-600 mt-1 font-mono">
                    <span>Telp/WA: <b>{storeProfile.phone || '0812-3456-7890'}</b></span>
                    {storeProfile.npwp && <span>NPWP: <b>{storeProfile.npwp}</b></span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-block border-2 border-stone-800 px-3 py-1.5 rounded-lg bg-stone-50">
                    <span className="text-[10px] uppercase font-black tracking-widest text-stone-500 block">DOKUMEN NIAGA</span>
                    <span className="text-sm font-black text-stone-900 tracking-wider">FAKTUR PENJUALAN</span>
                  </div>
                  <div className="mt-2 text-right">
                    <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${
                      isLunas 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400' 
                        : 'bg-amber-100 text-amber-800 border-amber-400'
                    }`}>
                      STATUS: {isLunas ? 'LUNAS' : 'TEMPO / BELUM LUNAS'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. INFORMASI PELANGGAN & DETAIL FAKTUR (GRID 2 KOLOM) */}
              <div className="grid grid-cols-2 gap-6 py-4 text-xs border-b border-stone-300">
                {/* Kolom Kiri: Kepada Yth. (Pelanggan) */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Kepada Yth. (Pelanggan):</div>
                  <div className="text-sm font-extrabold text-stone-900">{custName}</div>
                  <div className="text-stone-600 flex items-start space-x-1.5 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{custAddress}</span>
                  </div>
                  <div className="text-stone-600 flex items-center space-x-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>{custPhone}</span>
                  </div>
                  {custCode !== '-' && (
                    <div className="text-[11px] text-stone-500 font-mono">
                      ID / No. Member: <b>{custCode}</b>
                    </div>
                  )}
                </div>

                {/* Kolom Kanan: Rincian Faktur & Pembayaran */}
                <div className="space-y-1 bg-stone-50 p-3 rounded-lg border border-stone-200">
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-stone-500">No. Faktur:</span>
                    <span className="font-mono font-bold text-stone-900 text-right">{transaction.receipt_number}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-stone-500">Tanggal Faktur:</span>
                    <span className="font-semibold text-stone-800 text-right">{formattedDate}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-stone-500">Metode Bayar:</span>
                    <span className="font-bold text-stone-900 text-right uppercase">{transaction.payment_method}</span>
                  </div>
                  {transaction.due_date && (
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-amber-900">
                      <span className="font-semibold">Jatuh Tempo:</span>
                      <span className="font-mono font-bold text-right">{dueDateFormatted}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-stone-200">
                    <span className="text-stone-500">Kasir / Operator:</span>
                    <span className="text-stone-800 text-right">{transaction.cashier_name || 'Kasir'}</span>
                  </div>
                </div>
              </div>

              {/* 3. TABEL ITEM TRANSAKSI */}
              <div className="py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t-2 border-b-2 border-stone-800 bg-stone-100 text-stone-800">
                      <th className="py-2 px-2 text-center w-8 font-bold">No</th>
                      <th className="py-2 px-2 text-left font-bold">Deskripsi Barang / Sparepart</th>
                      <th className="py-2 px-2 text-center w-16 font-bold">Satuan</th>
                      <th className="py-2 px-2 text-center w-14 font-bold">Qty</th>
                      <th className="py-2 px-2 text-right w-24 font-bold">Harga (Rp)</th>
                      <th className="py-2 px-2 text-right w-28 font-bold">Subtotal (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {transaction.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-stone-50">
                        <td className="py-2.5 px-2 text-center font-mono text-stone-500">{idx + 1}</td>
                        <td className="py-2.5 px-2">
                          <div className="font-bold text-stone-900">{item.product_name}</div>
                          {item.barcode && item.barcode !== item.product_id && (
                            <div className="text-[10px] font-mono text-stone-400">Kode: {item.barcode}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center text-stone-600">{item.unit || 'Pcs'}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-stone-900">{item.qty}</td>
                        <td className="py-2.5 px-2 text-right font-mono text-stone-700">
                          {formatRupiah(item.price_applied)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-stone-900">
                          {formatRupiah(item.subtotal_item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. TOTAL, TERBILANG, CATATAN & TANDA TANGAN */}
            <div className="pt-2 space-y-4">
              
              {/* Subtotal, Pajak, Grand Total Grid */}
              <div className="grid grid-cols-12 gap-4 border-t-2 border-stone-800 pt-3">
                {/* Sisi Kiri: Terbilang & Catatan Pembayaran */}
                <div className="col-span-7 space-y-2.5">
                  <div className="p-2.5 bg-stone-50 rounded-lg border border-dashed border-stone-300">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Terbilang:</span>
                    <span className="text-xs font-bold italic text-stone-800">{terbilangText}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/80 text-[11px] text-stone-700 space-y-1">
                    <div className="font-bold text-stone-800 flex items-center space-x-1">
                      <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                      <span>Informasi Pembayaran & Rekening Toko:</span>
                    </div>
                    <p className="leading-snug text-stone-600">
                      Transfer Bank: <b>BCA 012-345-6789</b> a/n <b>CV Tumbuh Makmur Air Conindo</b>
                    </p>
                    <p className="text-[10px] text-stone-500 italic">
                      * {storeProfile.footer_message || 'Barang yang sudah dibeli dapat ditukar maksimal 2x24 jam dengan membawa faktur resmi ini.'}
                    </p>
                  </div>
                </div>

                {/* Sisi Kanan: Rekap Angka Pembayaran */}
                <div className="col-span-5 space-y-1.5 text-xs">
                  <div className="flex justify-between py-0.5 text-stone-600">
                    <span>Subtotal Barang:</span>
                    <span className="font-mono font-semibold text-stone-800">{formatRupiah(transaction.subtotal)}</span>
                  </div>

                  {transaction.discount_amount > 0 && (
                    <div className="flex justify-between py-0.5 text-rose-700 font-semibold">
                      <span>Diskon / Potongan:</span>
                      <span className="font-mono">-{formatRupiah(transaction.discount_amount)}</span>
                    </div>
                  )}

                  {transaction.tax_amount > 0 && (
                    <div className="flex justify-between py-0.5 text-stone-600">
                      <span>PPN (11%):</span>
                      <span className="font-mono font-semibold text-stone-800">{formatRupiah(transaction.tax_amount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-t-2 border-b-2 border-stone-800 text-sm font-black text-stone-900 bg-stone-50 px-2 rounded">
                    <span>TOTAL TAGIHAN:</span>
                    <span className="font-mono text-[#96633b]">{formatRupiah(grandTotal)}</span>
                  </div>

                  {transaction.payment_method === 'CASH' && (
                    <div className="space-y-1 pt-1 text-[11px] text-stone-600">
                      <div className="flex justify-between">
                        <span>Uang Diterima:</span>
                        <span className="font-mono font-semibold">{formatRupiah(cashGiven)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-800">
                        <span>Uang Kembalian:</span>
                        <span className="font-mono">{formatRupiah(changeReturned)}</span>
                      </div>
                    </div>
                  )}

                  {transaction.payment_method === 'TEMPO' && (
                    <div className="space-y-1 pt-1 text-[11px] text-stone-600">
                      <div className="flex justify-between">
                        <span>Uang Muka (DP):</span>
                        <span className="font-mono font-semibold">{formatRupiah(cashGiven)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-800">
                        <span>Sisa Piutang:</span>
                        <span className="font-mono">{formatRupiah(Math.max(0, grandTotal - cashGiven))}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. KOLOM TANDA TANGAN RESMI */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-stone-700">
                <div>
                  <p className="font-semibold text-stone-600">Tanda Terima / Pelanggan,</p>
                  <div className="h-16" />
                  <p className="font-bold text-stone-900 border-t border-stone-400 inline-block px-8 pt-1">
                    ( {custName} )
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-stone-600">Hormat Kami / Kasir Toko,</p>
                  <div className="h-16" />
                  <p className="font-bold text-stone-900 border-t border-stone-400 inline-block px-8 pt-1">
                    ( {transaction.cashier_name || 'Petugas Kasir'} )
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Bottom Info Bar (Hidden on Print) */}
        <div className="no-print px-4 sm:px-6 lg:px-8 py-3 bg-white border-t border-[#e5d0be] flex items-center justify-between text-xs text-[#5c3c26]">
          <span className="text-[11px] text-[#8a6b53]">
            💡 <b>Tips:</b> Gunakan tombol <b>Cetak Faktur</b> untuk mencetak ke kertas A4 atau simpan langsung ke file PDF via dialog cetak.
          </span>
        </div>

      </div>
    </div>
  );
};
