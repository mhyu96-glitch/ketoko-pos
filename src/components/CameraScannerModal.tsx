import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, RefreshCw, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';
import type { Product } from '../types';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  products: Product[];
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  products
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsStarting(true);
    setError(null);
    setDetectedCode(null);

    // Initialize BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      try {
        detectorRef.current = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });
      } catch (e) {
        console.warn('BarcodeDetector format init error:', e);
      }
    }

    const startCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsStarting(false);

        // Start detection interval
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;

          if (detectorRef.current) {
            try {
              const barcodes = await detectorRef.current.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                if (rawValue) {
                  setDetectedCode(rawValue);
                  clearInterval(scanIntervalRef.current);
                  onDetected(rawValue);
                  setTimeout(() => onClose(), 600);
                }
              }
            } catch (err) {
              // ignore detection frame errors
            }
          }
        }, 200);

      } catch (err: any) {
        if (!isMounted) return;
        setIsStarting(false);
        setError(err.name === 'NotAllowedError' 
          ? 'Izin akses kamera ditolak. Silakan izinkan kamera pada browser.' 
          : 'Kamera tidak dapat diakses atau tidak terdeteksi.');
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, onDetected, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col relative text-white">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white leading-tight">Scanner Barcode Kamera</h3>
              <p className="text-[11px] text-slate-400">Arahkan barcode produk ke dalam kotak scanner</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Camera Viewport */}
        <div className="relative w-full h-72 sm:h-80 bg-black flex items-center justify-center overflow-hidden">
          {isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-950 z-20">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
              <p className="text-xs font-semibold">Mengaktifkan kamera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-950 z-20">
              <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-xs text-slate-300 font-semibold mb-3">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
              >
                Tutup Scanner
              </button>
            </div>
          )}

          {/* Video element */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Scanner Overlay Guide Frame */}
          {!error && !isStarting && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-60 h-44 border-2 border-emerald-500/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400" />

                {/* Laser Animation Line */}
                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse relative top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          {/* Detected Feedback Banner */}
          {detectedCode && (
            <div className="absolute bottom-4 left-4 right-4 bg-emerald-600 text-white p-2.5 rounded-xl flex items-center space-x-2 animate-bounce z-30 shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <div className="text-xs font-bold truncate">
                Barcode terdeteksi: <span className="font-mono">{detectedCode}</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Sample Click fallback inside Camera View */}
        <div className="p-3.5 bg-slate-900 border-t border-slate-800">
          <p className="text-[11px] text-slate-400 mb-2 flex items-center">
            <Zap className="w-3 h-3 text-amber-400 mr-1" />
            Atau klik produk di bawah untuk simulasi scan instan:
          </p>
          <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {products.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onDetected(p.barcode);
                  onClose();
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-800/60 border border-slate-700 hover:border-emerald-500 rounded-lg text-[10px] text-slate-200 font-semibold whitespace-nowrap transition-colors"
              >
                {p.name.split(' ')[0]} ({p.barcode.slice(-4)})
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

