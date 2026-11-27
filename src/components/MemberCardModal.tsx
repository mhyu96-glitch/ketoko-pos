import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  QrCode, 
  Check, 
  Copy, 
  ShieldCheck, 
  UserCheck, 
  Download, 
  Smartphone, 
  Send 
} from 'lucide-react';
import QRCode from 'qrcode';
import type { Customer } from '../types';
import { generateBarcodeSvg, drawBarcodeToCanvas } from '../utils/barcodeGenerator';
import { formatRupiah } from '../services/escposService';
import {
  checkCustomerBranchAccess,
  formatCustomerAddressDisplay,
  getCurrentActiveStoreId,
  getStoreDisplayName,
  MAX_EMPLOYEE_ALLOWANCE,
  normalizeAccessScope,
  normalizeStoreId
} from '../utils/customerAccess';

interface MemberCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Customer | null;
  storeName?: string;
  onApplyToPos?: (memberId: string, member: Customer) => void;
}

export const MemberCardModal: React.FC<MemberCardModalProps> = ({
  isOpen,
  onClose,
  member,
  storeName,
  onApplyToPos
}) => {
  const resolvedStoreName = storeName || getStoreDisplayName(getCurrentActiveStoreId());
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [cardTheme, setCardTheme] = useState<'emerald' | 'indigo' | 'dark'>('emerald');
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const memberCode = member?.code || member?.id || 'MBR-001';
  const memberName = member?.name || 'Pelanggan Member';
  const memberPhone = member?.phone && member.phone !== '-' ? member.phone : '-';
  const cleanAddr = formatCustomerAddressDisplay(member?.address);
  const memberAddress = cleanAddr !== '-' ? cleanAddr : 'Bente Tualan, Kab. Paser';
  const isEmployee = member?.type === 'KARYAWAN';
  const creditLimit = isEmployee ? Math.min(MAX_EMPLOYEE_ALLOWANCE, Number(member?.monthly_allowance || member?.credit_limit) || MAX_EMPLOYEE_ALLOWANCE) : (member?.credit_limit || 1500000);
  const depositBalance = isEmployee ? Math.min(creditLimit, Math.max(0, Number(member?.deposit_balance) || 0)) : (Number(member?.deposit_balance) || 0);
  const homeStoreId = normalizeStoreId(member?.store_id);
  const homeStoreName = getStoreDisplayName(homeStoreId, member?.store_name);
  const accessScope = normalizeAccessScope(member?.access_scope);
  const branchBadgeText = accessScope === 'ALL_STORES' ? 'SEMUA CABANG' : `KHUSUS ${homeStoreName.toUpperCase()}`;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Generate QR Code data URL whenever member changes
  useEffect(() => {
    if (!member) return;
    const qrPayload = member.code || member.id;
    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Gagal membuat QR Code member:', err));
  }, [member]);

  if (!isOpen || !member) return null;

  const barcodeSvgHtml = generateBarcodeSvg(memberCode, 36, false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(memberCode);
    setCopied(true);
    showToast(`Kode "${memberCode}" disalin ke clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to render high-res card to canvas (1000 x 630 px, standard CR80 aspect ratio ~ 1.587)
  const renderCardToCanvas = async (theme: 'emerald' | 'indigo' | 'dark'): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context tidak tersedia');

    // Enable high quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Rounded rectangle clipping path
    const cornerRadius = 38;
    ctx.beginPath();
    ctx.moveTo(cornerRadius, 0);
    ctx.lineTo(canvas.width - cornerRadius, 0);
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
    ctx.lineTo(canvas.width, canvas.height - cornerRadius);
    ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height);
    ctx.lineTo(cornerRadius, canvas.height);
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
    ctx.lineTo(0, cornerRadius);
    ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
    ctx.closePath();
    ctx.clip();

    // 2. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (theme === 'emerald') {
      bgGrad.addColorStop(0, '#022c22');
      bgGrad.addColorStop(0.45, '#064e3b');
      bgGrad.addColorStop(1, '#047857');
    } else if (theme === 'indigo') {
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.45, '#1e1b4b');
      bgGrad.addColorStop(1, '#312e81');
    } else {
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.45, '#0f172a');
      bgGrad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Ambient Glow Orbs
    const glow1 = ctx.createRadialGradient(canvas.width - 50, canvas.height - 50, 10, canvas.width - 50, canvas.height - 50, 320);
    glow1.addColorStop(0, theme === 'emerald' ? 'rgba(52, 211, 153, 0.25)' : theme === 'indigo' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.12)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow2 = ctx.createRadialGradient(100, 100, 10, 100, 100, 260);
    glow2.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative metallic card border
    ctx.strokeStyle = theme === 'emerald' ? 'rgba(110, 231, 183, 0.35)' : theme === 'indigo' ? 'rgba(165, 180, 252, 0.35)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 4. EMV Gold Smart Chip (Realistic)
    const chipX = 55;
    const chipY = 135;
    const chipW = 76;
    const chipH = 54;
    const chipRadius = 8;
    
    // Chip Body with Gold Gradient
    const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
    chipGrad.addColorStop(0, '#fef08a');
    chipGrad.addColorStop(0.3, '#f59e0b');
    chipGrad.addColorStop(0.7, '#fbbf24');
    chipGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = chipGrad;
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, chipH, chipRadius);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Chip Contacts (Inner Grid)
    ctx.strokeStyle = 'rgba(146, 64, 14, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(chipX, chipY + chipH * 0.4);
    ctx.lineTo(chipX + chipW * 0.35, chipY + chipH * 0.4);
    ctx.lineTo(chipX + chipW * 0.35, chipY + chipH * 0.6);
    ctx.lineTo(chipX, chipY + chipH * 0.6);

    ctx.moveTo(chipX + chipW, chipY + chipH * 0.4);
    ctx.lineTo(chipX + chipW * 0.65, chipY + chipH * 0.4);
    ctx.lineTo(chipX + chipW * 0.65, chipY + chipH * 0.6);
    ctx.lineTo(chipX + chipW, chipY + chipH * 0.6);

    ctx.moveTo(chipX + chipW * 0.5, chipY);
    ctx.lineTo(chipX + chipW * 0.5, chipY + chipH);
    ctx.stroke();

    // 5. Contactless Wave Icon (NFC PayWave)
    const waveCenterX = chipX + chipW + 28;
    const waveCenterY = chipY + chipH * 0.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let r = 9; r <= 24; r += 7) {
      ctx.beginPath();
      ctx.arc(waveCenterX, waveCenterY, r, -Math.PI * 0.3, Math.PI * 0.3, false);
      ctx.stroke();
    }

    // 6. Header: Store Name & Cooperative Brand
    // Star emblem
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(68, 62, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 68, 63);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(resolvedStoreName.toUpperCase().slice(0, 42), 98, 54);

    ctx.fillStyle = theme === 'emerald' ? '#a7f3d0' : theme === 'indigo' ? '#c7d2fe' : '#e2e8f0';
    ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('KARTU ANGGOTA KARYAWAN RESMI • DIGITAL ID', 98, 76);

    // Top Right Gold Badge
    const badgeText = 'MEMBER GOLD / AKTIF';
    ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
    const badgeWidth = ctx.measureText(badgeText).width + 24;
    const badgeX = canvas.width - 55 - badgeWidth;
    const badgeY = 46;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, 32, 16);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 17);

    // 7. Member Information (Left Body)
    const infoStartX = 55;
    const infoStartY = 230;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('NAMA LENGKAP KARYAWAN / ANGGOTA', infoStartX, infoStartY);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Segoe UI", Roboto, sans-serif';
    let displayCustName = memberName;
    if (ctx.measureText(displayCustName).width > 480) {
      displayCustName = displayCustName.slice(0, 24) + '...';
    }
    ctx.fillText(displayCustName, infoStartX, infoStartY + 36);

    // Member Code / NIK Badge Box
    const nikBoxY = infoStartY + 52;
    const nikText = memberCode;
    ctx.font = 'bold 20px "Courier New", Courier, monospace';
    const nikWidth = ctx.measureText(nikText).width + 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(infoStartX, nikBoxY, nikWidth, 36, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(nikText, infoStartX + 15, nikBoxY + 24);

    // Additional info: Phone, Address/Dept, Cabang & Plafon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '14px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`📞 ${memberPhone} • 📍 ${memberAddress}`, infoStartX, nikBoxY + 58);
    ctx.fillStyle = accessScope === 'ALL_STORES' ? '#a5b4fc' : '#6ee7b7';
    ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`🏪 Akses: ${homeStoreName} (${accessScope === 'ALL_STORES' ? 'Semua Cabang' : 'Khusus Cabang Ini'})`, infoStartX, nikBoxY + 82);
    
    const formattedLimit = formatRupiah(creditLimit);
    const formattedDeposit = formatRupiah(depositBalance);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`💵 Saldo Member: ${formattedDeposit}`, infoStartX, nikBoxY + 108);
    ctx.fillStyle = '#fde047';
    ctx.font = '13px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`💰 Plafon Belanja: ${formattedLimit}`, infoStartX, nikBoxY + 130);

    // 8. Right Side: High-Definition QR Code Box
    const qrBoxSize = 195;
    const qrBoxX = canvas.width - 55 - qrBoxSize;
    const qrBoxY = 125;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 28, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw QR image
    if (qrDataUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = qrDataUrl;
      });
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN QR DI KASIR', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize + 14);

    // 9. Bottom Bar: 1D Barcode Container Box
    const barcodeBoxX = 55;
    const barcodeBoxY = canvas.height - 110;
    const barcodeBoxW = 440;
    const barcodeBoxH = 78;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(barcodeBoxX, barcodeBoxY, barcodeBoxW, barcodeBoxH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw Barcode Bars via helper
    drawBarcodeToCanvas(ctx, memberCode, barcodeBoxX + 20, barcodeBoxY + 10, barcodeBoxW - 40, 38, '#000000');

    // Barcode Text Below Bars
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 13px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(memberCode, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 64);

    // 10. Bottom-Right Security & Usage Guide
    const guideX = canvas.width - 55;
    const guideY = canvas.height - 90;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✓ Kompatibel 100% Barcode Scanner Kasir', guideX, guideY);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '12px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Simpan gambar di galeri HP & tunjukkan saat belanja', guideX, guideY + 22);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'italic 11px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Sistem Pembayaran Koperasi Terintegrasi POS Ketoko', guideX, guideY + 40);

    return canvas;
  };

  // Helper to render compact sticker (600 x 320 px)
  const renderStickerToCanvas = async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context tidak tersedia');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background with border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    // Header
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(6, 6, canvas.width - 12, 44);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(resolvedStoreName.toUpperCase().slice(0, 44), canvas.width / 2, 32);

    // Member Name & NIK
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText(memberName, canvas.width / 2, 80);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(`ID / NIK: ${memberCode}`, canvas.width / 2, 102);

    // Left: Barcode 1D
    drawBarcodeToCanvas(ctx, memberCode, 30, 126, 340, 70, '#000000');
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(memberCode, 200, 220);

    // Right: QR Code 2D
    if (qrDataUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 410, 116, 140, 140);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = qrDataUrl;
      });
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillText('SCAN QR', 480, 270);
    }

    // Footer guide
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText('Tunjukkan barcode ini ke kasir saat berbelanja', canvas.width / 2, 298);

    return canvas;
  };

  // Download Full Digital Card PNG
  const handleDownloadCard = async () => {
    try {
      setIsDownloading(true);
      const canvas = await renderCardToCanvas(cardTheme);
      const cleanName = memberName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanCode = memberCode.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Kartu-Koperasi-${cleanCode}-${cleanName}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Gambar kartu HD berhasil diunduh! Siap disimpan di HP karyawan.');
    } catch (err) {
      console.error('Gagal mengunduh kartu member:', err);
      alert('Gagal membuat gambar kartu member.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Download Barcode Sticker PNG
  const handleDownloadBarcodeOnly = async () => {
    try {
      setIsDownloading(true);
      const canvas = await renderStickerToCanvas();
      const cleanCode = memberCode.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Barcode-Stiker-${cleanCode}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Stiker barcode berhasil diunduh!');
    } catch (err) {
      console.error('Gagal mengunduh stiker barcode:', err);
      alert('Gagal membuat stiker barcode.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Share to WhatsApp with complete employee guidance
  const handleShareWhatsApp = () => {
    let cleanPhone = (memberPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }

    const message = 
`*KARTU ANGGOTA KOPERASI DIGITAL*
================================
Halo Bpk/Ibu *${memberName}*,

Berikut adalah data kartu & barcode keanggotaan Koperasi Anda:
• *Nama:* ${memberName}
• *NIK / ID Anggota:* \`${memberCode}\`
• *Saldo Simpanan:* ${formatRupiah(depositBalance)} (Aktif di Toko A & B)
• *Plafon Limit Belanja:* ${formatRupiah(creditLimit)}
• *Status Keanggotaan:* Anggota Aktif Koperasi (Akses Semua Cabang)

📌 *Petunjuk Belanja di Kasir:*
1. Simpan gambar kartu/barcode yang telah dikirimkan ini di galeri HP Anda.
2. Saat berbelanja di kasir koperasi, cukup buka foto tersebut di layar HP Anda dan tunjukkan ke petugas kasir.
3. Scanner kasir akan otomatis memindai barcode/QR dan mencatat belanja atau memotong saldo Anda secara otomatis.

Terima kasih.
*${resolvedStoreName}*`;

    if (cleanPhone && cleanPhone.length >= 9) {
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      showToast('Membuka WhatsApp untuk mengirim kartu ke karyawan...');
    } else {
      navigator.clipboard.writeText(message);
      alert(`Nomor WhatsApp karyawan belum lengkap/terdaftar (${memberPhone}). Format teks resmi telah otomatis disalin ke clipboard! Anda bisa langsung paste di chat WhatsApp karyawan.`);
    }
  };

  // Print Physical CR80 Card
  const handlePrintCard = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Pop-up terblokir. Izinkan pop-up di browser untuk mencetak kartu member.');
      return;
    }

    const themeBg = cardTheme === 'emerald' 
      ? 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)'
      : cardTheme === 'indigo'
      ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)'
      : 'linear-gradient(135deg, #090d16 0%, #1e293b 50%, #0f172a 100%)';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cetak Kartu Member - ${memberName}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .card-container {
            width: 85.6mm;
            height: 54mm;
            background: ${themeBg};
            color: #fff;
            border-radius: 4mm;
            padding: 4mm 5mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 2mm; }
          .store-name { font-size: 9pt; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
          .badge { font-size: 6.5pt; font-weight: bold; background: rgba(255,255,255,0.2); padding: 1mm 2mm; border-radius: 2mm; text-transform: uppercase; }
          .body-content { display: flex; justify-content: space-between; align-items: center; margin: 2mm 0; }
          .member-info { flex: 1; }
          .member-name { font-size: 11pt; font-weight: 900; margin: 0; line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
          .member-code { font-family: monospace; font-size: 8.5pt; color: #a7f3d0; margin-top: 1mm; font-weight: bold; letter-spacing: 1px; }
          .member-sub { font-size: 7pt; color: rgba(255,255,255,0.7); margin-top: 0.5mm; }
          .qr-box { background: #fff; padding: 1.5mm; border-radius: 2mm; width: 18mm; height: 18mm; display: flex; align-items: center; justify-content: center; }
          .qr-box img { width: 100%; height: 100%; object-fit: contain; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 1.5mm; }
          .barcode-box { max-width: 45mm; height: 7mm; background: #fff; padding: 0.5mm 1.5mm; border-radius: 1mm; }
          .barcode-box svg { width: 100%; height: 100%; }
          .note { font-size: 6pt; color: rgba(255,255,255,0.6); text-align: right; }
          .no-print { margin-top: 20px; font-size: 10pt; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card-container">
          <div class="header">
            <div class="store-name">${resolvedStoreName}</div>
            <div class="badge">${isEmployee ? 'KARTU KARYAWAN' : 'KARTU ANGGOTA'}</div>
          </div>
          <div class="body-content">
            <div class="member-info">
              <h2 class="member-name">${memberName}</h2>
              <div class="member-code">${memberCode}</div>
              ${memberPhone !== '-' ? `<div class="member-sub">📞 ${memberPhone}</div>` : ''}
              <div class="member-sub">📍 ${memberAddress}</div>
              <div class="member-sub" style="color: #6ee7b7; font-weight: bold; margin-top: 1mm;">${isEmployee ? `Plafon Rp 2.000.000/Bln • Reset Tgl 1` : `💵 Saldo: ${formatRupiah(depositBalance)}`} • ${branchBadgeText}</div>
            </div>
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="QR Member" />
            </div>
          </div>
          <div class="footer">
            <div class="barcode-box">
              ${barcodeSvgHtml}
            </div>
            <div class="note">
              Scan barcode / QR untuk bertransaksi di kasir
            </div>
          </div>
        </div>
        <div class="no-print">
          Mencetak otomatis... Jika tidak muncul dialog cetak, tekan <b>Ctrl + P</b>.
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const currentThemeClasses = cardTheme === 'emerald'
    ? 'from-emerald-950 via-slate-900 to-teal-950 border-emerald-500/40 text-emerald-300'
    : cardTheme === 'indigo'
    ? 'from-indigo-950 via-slate-900 to-blue-950 border-indigo-500/40 text-indigo-300'
    : 'from-slate-950 via-neutral-900 to-slate-900 border-slate-700 text-slate-300';

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      <div className="bg-slate-50 w-full h-full flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">Kartu Digital & Barcode Karyawan</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Siap Scan Kasir
                </span>
              </div>
              <p className="text-xs text-slate-500">Admin dapat mengunduh gambar kartu / barcode untuk disimpan karyawan di HP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shadow-2xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-8 space-y-4 overflow-y-auto flex-1 custom-scroll max-w-3xl mx-auto w-full">
          
          {/* Toast Notification */}
          {toastMessage && (
            <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Workflow Guide Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 text-xs shadow-xs">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 font-extrabold block mb-0.5">Cara Penggunaan untuk Karyawan Koperasi:</strong>
              Klik <strong>"Simpan Gambar (PNG)"</strong> lalu kirimkan file foto ke karyawan (bisa via WhatsApp). Karyawan cukup menyimpan gambar tersebut di galeri HP dan menunjukkannya ke scanner kasir saat berbelanja untuk pemotongan saldo / pencatatan otomatis.
            </div>
          </div>

          {/* Card Theme Picker */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Pilih Tema Kartu:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCardTheme('emerald')}
                className={`w-6 h-6 rounded-full bg-emerald-600 border-2 transition-all ${cardTheme === 'emerald' ? 'border-emerald-950 ring-2 ring-emerald-300 scale-110 shadow-xs' : 'border-transparent opacity-70'}`}
                title="Emerald Green"
              />
              <button
                type="button"
                onClick={() => setCardTheme('indigo')}
                className={`w-6 h-6 rounded-full bg-indigo-600 border-2 transition-all ${cardTheme === 'indigo' ? 'border-indigo-950 ring-2 ring-indigo-300 scale-110 shadow-xs' : 'border-transparent opacity-70'}`}
                title="Indigo Blue"
              />
              <button
                type="button"
                onClick={() => setCardTheme('dark')}
                className={`w-6 h-6 rounded-full bg-slate-900 border-2 transition-all ${cardTheme === 'dark' ? 'border-slate-950 ring-2 ring-slate-400 scale-110 shadow-xs' : 'border-transparent opacity-70'}`}
                title="Obsidian Dark"
              />
            </div>
          </div>

          {/* VIRTUAL PHYSICAL CARD (CR80 RATIO) */}
          <div 
            ref={cardRef}
            className={`w-full bg-gradient-to-br ${currentThemeClasses} text-white rounded-3xl p-5 sm:p-6 shadow-xl border relative overflow-hidden flex flex-col justify-between aspect-[1.586/1] min-h-[220px] transition-all`}
          >
            {/* Ambient Background Glow */}
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>
            <div className="absolute -left-10 -top-10 w-36 h-36 rounded-full bg-white/5 blur-xl pointer-events-none"></div>

            {/* Card Header */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-amber-300 text-sm shadow-xs">
                  ★
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black tracking-wide text-white uppercase">{resolvedStoreName}</h4>
                  <p className="text-[10px] text-white/60 tracking-wider">KARTU BELANJA KARYAWAN • FISIK & DIGITAL</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                MEMBER GOLD
              </span>
            </div>

            {/* Card Middle: Member Name + Live QR Code */}
            <div className="flex items-center justify-between gap-4 my-auto relative z-10">
              <div className="flex-1 min-w-0 pr-2">
                <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Nama Anggota Koperasi</div>
                <h3 className="text-lg sm:text-2xl font-black text-white truncate drop-shadow-sm mt-0.5">
                  {memberName}
                </h3>
                
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="font-mono text-sm sm:text-base font-black tracking-widest text-emerald-300 bg-black/40 px-2.5 py-0.5 rounded-lg border border-white/10">
                    {memberCode}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-mono">
                    Saldo: {formatRupiah(depositBalance)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                    title="Salin Kode Member"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="text-[11px] text-white/75 mt-2 space-y-0.5">
                  <div>📞 {memberPhone}</div>
                  <div className="truncate">📍 {memberAddress}</div>
                  <div className={`font-bold truncate ${accessScope === 'ALL_STORES' ? 'text-indigo-200' : 'text-emerald-200'}`}>
                    🏪 {branchBadgeText}
                  </div>
                </div>
              </div>

              {/* QR Code Canvas Box */}
              <div className="shrink-0 bg-white p-2 sm:p-2.5 rounded-2xl shadow-lg border border-white/30 flex flex-col items-center">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt={`QR Code ${memberCode}`}
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain" 
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                    Membuat QR...
                  </div>
                )}
                <span className="text-[9px] font-mono font-bold text-slate-900 mt-1">SCAN QR INI</span>
              </div>
            </div>

            {/* Card Footer: 1D Barcode Strip */}
            <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-3 relative z-10">
              <div className="bg-white px-2 py-0.5 rounded-lg shadow-xs max-w-[190px] sm:max-w-[240px] overflow-hidden">
                <div dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }} className="h-6 flex items-center" />
              </div>
              <div className="text-right text-[10px] text-white/70 font-semibold">
                <span>Plafon Limit: </span>
                <strong className="text-amber-300 font-bold">{formatRupiah(creditLimit)}</strong>
              </div>
            </div>
          </div>

          {/* Quick Scanner Testing Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-slate-900">Kompatibel 100% Barcode Scanner Kasir</p>
                <p className="text-slate-500">Bisa di-scan dari layar HP (Optical 2D scanner) maupun scanner laser 1D kasir.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Main Download & Share Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadCard}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all flex items-center gap-2 text-xs sm:text-sm shadow-md active:scale-95 disabled:opacity-50"
              title="Unduh gambar PNG beresolusi tinggi untuk disimpan di galeri smartphone karyawan"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>{isDownloading ? 'Menyimpan...' : 'Simpan Gambar (PNG)'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-extrabold hover:bg-emerald-100 transition-all flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-2xs"
              title="Kirim pesan rincian kartu dan NIK ke WhatsApp karyawan"
            >
              <Send className="w-4 h-4 text-emerald-600" />
              <span>Kirim ke WA</span>
            </button>

            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadBarcodeOnly}
              className="px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs active:scale-95 shadow-2xs"
              title="Unduh gambar stiker barcode murni untuk cetak mini label"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-600" />
              <span>Barcode Saja</span>
            </button>

            <button
              type="button"
              onClick={handlePrintCard}
              className="px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-all flex items-center gap-1.5 text-xs active:scale-95 shadow-2xs"
              title="Cetak fisik ukuran kartu ATM (CR80)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak Kartu</span>
            </button>
          </div>

          {/* POS Selection or Close */}
          <div className="flex items-center gap-2">
            {onApplyToPos && (() => {
              const cardBranchAccess = checkCustomerBranchAccess(member, getCurrentActiveStoreId());
              return (
                <button
                  type="button"
                  onClick={() => {
                    onApplyToPos(member.id, member);
                    if (cardBranchAccess.allowed) {
                      onClose();
                    }
                  }}
                  className={`px-4 py-2.5 rounded-xl font-black transition-all flex items-center gap-2 text-xs sm:text-sm shadow-md active:scale-95 ${
                    cardBranchAccess.allowed
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200'
                  }`}
                  title={cardBranchAccess.allowed ? 'Gunakan member ini di kasir' : cardBranchAccess.reason}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{cardBranchAccess.allowed ? 'Pilih Member di Kasir' : `Terkunci (Khusus ${homeStoreName})`}</span>
                </button>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
};
