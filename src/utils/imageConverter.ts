/**
 * Utility for converting and optimizing product images to high-performance WebP Base64 Data URL.
 * Automatically resizes image dimensions and applies high quality compression for IndexedDB.
 */

export interface ImageConversionResult {
  dataUrl: string;
  originalSizeKb: number;
  webpSizeKb: number;
  width: number;
  height: number;
}

export async function convertImageFileToWebP(
  file: File,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.85
): Promise<ImageConversionResult> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File yang dipilih bukan berkas gambar yang valid.'));
      return;
    }

    const originalSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while bounding within maxWidth & maxHeight
        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D Context tidak tersedia pada peramban.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP format
        let webpDataUrl = canvas.toDataURL('image/webp', quality);

        // Fallback to jpeg if webp is not supported by legacy engine
        if (!webpDataUrl.startsWith('data:image/webp')) {
          webpDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Calculate approximate size from base64 string
        const head = webpDataUrl.indexOf(',') + 1;
        const webpSizeKb = Math.round(((webpDataUrl.length - head) * 3) / 4 / 1024);

        resolve({
          dataUrl: webpDataUrl,
          originalSizeKb,
          webpSizeKb,
          width,
          height
        });
      };

      img.onerror = () => {
        reject(new Error('Gagal memproses dan merender format gambar.'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca berkas gambar dari perangkat.'));
    };

    reader.readAsDataURL(file);
  });
}

