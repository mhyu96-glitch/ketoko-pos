import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface PromoHeroBannerProps {
  onExploreProducts: () => void;
  totalProducts: number;
}

export const PromoHeroBanner: React.FC<PromoHeroBannerProps> = ({
  onExploreProducts,
  totalProducts
}) => {
  return (
    <div className="relative rounded-3xl bg-gradient-to-r from-[#96633b] via-[#a6744c] to-[#af7c54] text-white p-6 sm:p-8 overflow-hidden shadow-lg mb-6 border border-[#85542f]">
      
      {/* Decorative background glows */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 right-1/3 w-80 h-80 bg-[#faebd7]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Left Text Content */}
        <div className="md:col-span-7 space-y-3.5">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#83532e]/80 border border-[#eed7c4]/40 text-amber-200 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Spesial Grosir & Diskon Member Aktif</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Belanja Hemat <span className="text-amber-200 font-black">Harga Grosir</span> Setiap Hari
          </h1>

          <p className="text-xs sm:text-sm text-[#fcefe3] leading-relaxed max-w-lg">
            Dapatkan produk sembako, makanan & minuman, dan kebutuhan toko terlengkap dengan harga grosir otomatis. Transaksi kasir secepat kilat (&lt;100ms) dengan dukungan offline penuh.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onExploreProducts}
              className="px-5 py-2.5 bg-white hover:bg-[#faebd7] text-[#96633b] font-black text-xs rounded-full shadow-md hover:shadow-lg transition-all flex items-center space-x-2 active:scale-95 border border-[#eed7c4]"
            >
              <span>Belanja Sekarang</span>
              <ArrowRight className="w-4 h-4 text-[#96633b]" />
            </button>

            <div className="hidden sm:flex items-center space-x-4 text-xs text-[#fcefe3] pl-2">
              <div className="flex items-center space-x-1">
                <ShieldCheck className="w-4 h-4 text-amber-200" />
                <span>100% Produk Berkualitas</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{totalProducts} SKU Siap Scan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Basket Illustration / Image */}
        <div className="md:col-span-5 flex justify-center md:justify-end">
          <div className="relative group">
            {/* Ambient shadow ring */}
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-2xl transform scale-90 group-hover:scale-105 transition-transform" />
            <img
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80"
              alt="Fresh Groceries Basket"
              className="relative w-56 sm:w-72 h-44 sm:h-52 object-cover rounded-2xl shadow-2xl border-2 border-white/20 transform group-hover:-translate-y-1 transition-transform"
            />
            {/* Promo badge floating */}
            <div className="absolute -bottom-3 -left-3 bg-white text-[#3d2617] px-3 py-1.5 rounded-xl shadow-xl border border-[#e5d0be] flex items-center space-x-2 text-xs font-bold animate-bounce">
              <span className="w-2 h-2 rounded-full bg-[#166534] animate-ping" />
              <span className="text-[#96633b]">Hemat s/d 30%</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
