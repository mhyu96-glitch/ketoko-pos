import React, { useState } from 'react';
import { 
  LogIn, 
  KeyRound, 
  User as UserIcon, 
  AlertCircle, 
  ShieldCheck, 
  UserCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { db } from '../db';
import type { User } from '../types';

interface LoginModalProps {
  isOpen?: boolean;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  onLoginSuccess
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCoveringEyes, setIsCoveringEyes] = useState(false);
  const [isTypingUser, setIsTypingUser] = useState(false);
  const [pupilShift, setPupilShift] = useState({ x: 0, y: 0, rot: 0 });
  const passwordInputRef = React.useRef<HTMLInputElement>(null);

  if (isOpen === false) return null;

  const handleSelectQuickAccount = (uname: string) => {
    setUsername(uname);
    setPassword('');
    setError(null);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setError('Silakan masukkan Username');
      setIsLoading(false);
      return;
    }

    if (!cleanPass) {
      setError('Silakan masukkan Kata Sandi (Password)');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Akun Superadmin / Developer Master
      if (cleanUser.toLowerCase() === 'superadmin' || cleanUser.toLowerCase() === 'developer') {
        const validSuperPins = ['5858', 'superadmin', 'developer58', 'tumbuhmakmur'];
        if (!validSuperPins.includes(cleanPass.toLowerCase())) {
          throw new Error('Kata sandi Superadmin salah! Akses ditolak.');
        }

        const superUser: User = {
          id: 'usr-000',
          username: cleanUser,
          name: 'Master Superadmin (Developer)',
          role: 'SUPERADMIN',
          branch_id: 'BR-01'
        };
        try { await db.users.put(superUser); } catch {}
        onLoginSuccess(superUser);
        return;
      }

      // 2. Akun Owner Toko (suciawati / admin)
      if (cleanUser.toLowerCase() === 'suciawati' || cleanUser.toLowerCase() === 'admin') {
        const validAdminPass = ['admin123', '123456', 'suciawati123', 'tumbuhmakmur', 'admin'];
        let matched = validAdminPass.includes(cleanPass.toLowerCase());

        const existingInDb = await db.users.where('username').equalsIgnoreCase(cleanUser).first();
        if (existingInDb && (existingInDb as any).password) {
          matched = (existingInDb as any).password === cleanPass;
        }

        if (!matched) {
          throw new Error('Kata sandi salah! Masukkan password akun ' + cleanUser);
        }

        const ownerUser: User = {
          id: 'usr-001',
          username: cleanUser,
          name: 'suciawati Ramadhani',
          role: 'ADMIN',
          branch_id: 'BR-01'
        };
        try { await db.users.put(ownerUser); } catch {}
        onLoginSuccess(ownerUser);
        return;
      }

      // 3. Akun Kasir (noor / kasir)
      if (cleanUser.toLowerCase() === 'noor' || cleanUser.toLowerCase() === 'kasir') {
        const validKasirPass = ['kasir123', '123456', 'noor123', 'kasir'];
        let matched = validKasirPass.includes(cleanPass.toLowerCase());

        const existingInDb = await db.users.where('username').equalsIgnoreCase(cleanUser).first();
        if (existingInDb && (existingInDb as any).password) {
          matched = (existingInDb as any).password === cleanPass;
        }

        if (!matched) {
          throw new Error('Kata sandi kasir salah! Masukkan password akun ' + cleanUser);
        }

        const cashierUser: User = {
          id: 'usr-002',
          username: cleanUser,
          name: 'Noor Afifah',
          role: 'CASHIER',
          branch_id: 'BR-01'
        };
        try { await db.users.put(cashierUser); } catch {}
        onLoginSuccess(cashierUser);
        return;
      }

      // 4. Akun lainnya dari DB Users
      let user: User | undefined = await db.users.where('username').equalsIgnoreCase(cleanUser).first();
      if (!user) {
        user = await db.usersLocal.where('username').equalsIgnoreCase(cleanUser).first();
      }

      if (user) {
        if ((user as any).password && (user as any).password !== cleanPass) {
          throw new Error('Kata sandi salah!');
        }
        onLoginSuccess(user);
        return;
      }

      throw new Error(`Username "${cleanUser}" tidak terdaftar di sistem toko.`);
    } catch (err: any) {
      setError(err.message || 'Login gagal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    const maxLen = 18;
    const len = Math.min(val.length, maxLen);
    setPupilShift({
      x: (len / maxLen) * 6 - 3,
      y: 3.2,
      rot: (len / maxLen) * 5 - 2.5
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8">
        
        {/* Branding Header with Animated Cashier Avatar */}
        <div className="text-center mb-4">
          <div className="w-24 h-24 mx-auto relative flex items-center justify-center mb-1">
            <svg viewBox="0 0 160 140" className="w-full h-full overflow-hidden rounded-full shadow-lg">
              <defs>
                <linearGradient id="lm-avatar-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3d1a08" />
                  <stop offset="50%" stopColor="#581c87" />
                  <stop offset="100%" stopColor="#3b0764" />
                </linearGradient>
                <linearGradient id="lm-apron-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7c3f1d" />
                  <stop offset="100%" stopColor="#4e250f" />
                </linearGradient>
                <linearGradient id="lm-cap-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b1d0c" />
                  <stop offset="100%" stopColor="#1f0c03" />
                </linearGradient>
              </defs>

              {/* Background circle badge */}
              <circle cx="80" cy="70" r="70" fill="url(#lm-avatar-bg)" />
              <circle cx="80" cy="70" r="67" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

              {/* Body & Apron */}
              <g>
                <path d="M 28 140 C 28 106 50 98 80 98 C 110 98 132 106 132 140 Z" fill="url(#lm-apron-grad)" />
                <path d="M 52 100 L 58 140 M 108 100 L 102 140" stroke="#3d1a08" strokeWidth="3" strokeLinecap="round" />
                <polygon points="68,98 80,112 92,98" fill="#ffffff" />
                <polygon points="72,102 88,102 80,109" fill="#f59e0b" />
                <circle cx="80" cy="122" r="6.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                <text x="80" y="124.5" fontSize="6.5" textAnchor="middle" fontWeight="bold" fill="#3d1a08">⚡</text>
              </g>

              {/* Head Group (tilts when typing username) */}
              <g style={{
                transformOrigin: '80px 70px',
                transform: isCoveringEyes ? 'translateY(2px) scale(0.98)' : `rotate(${pupilShift.rot}deg) translateY(${isTypingUser ? 2 : 0}px)`,
                transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.4, 1)'
              }}>
                <rect x="73" y="84" width="14" height="16" rx="3" fill="#f5c09e" />
                <circle cx="46" cy="66" r="6.5" fill="#fedac2" />
                <circle cx="46" cy="66" r="3.5" fill="#fca5a5" opacity="0.6" />
                <circle cx="114" cy="66" r="6.5" fill="#fedac2" />
                <circle cx="114" cy="66" r="3.5" fill="#fca5a5" opacity="0.6" />
                <ellipse cx="80" cy="66" rx="35" ry="31" fill="#fedac2" />

                {/* Blush */}
                <ellipse cx="57" cy="73" rx="5.5" ry="3" fill="#f87171" opacity="0.45" />
                <ellipse cx="103" cy="73" rx="5.5" ry="3" fill="#f87171" opacity="0.45" />

                {/* Hair & Cap */}
                <path d="M 45 62 C 45 44 55 35 80 35 C 105 35 115 44 115 62 C 115 70 112 75 112 75 C 112 66 108 46 80 46 C 52 46 48 66 48 75 C 48 75 45 70 45 62 Z" fill="#2b1407" />
                <path d="M 50 46 C 58 46 64 52 68 54 C 72 50 78 46 84 48 C 90 50 96 54 102 52 C 108 50 110 48 110 48 C 106 40 94 35 80 35 C 66 35 54 40 50 46 Z" fill="#2b1407" />
                <path d="M 48 42 C 48 22 62 14 80 14 C 98 14 112 22 112 42 Z" fill="url(#lm-cap-grad)" />
                <path d="M 41 42 C 41 37 58 36 80 36 C 102 36 119 37 119 42 C 119 47 100 44 80 44 C 60 44 41 47 41 42 Z" fill="#150802" />
                <circle cx="80" cy="28" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.8" />
                <text x="80" y="30" fontSize="5" textAnchor="middle" fill="#241106">☕</text>

                {/* Eyebrows */}
                <path d="M 58 55 Q 64 52 70 55" stroke="#2b1407" strokeWidth="2.2" strokeLinecap="round" fill="none" style={{
                  transform: isCoveringEyes ? 'translateY(-2px) rotate(5deg)' : 'none',
                  transition: 'transform 0.3s ease'
                }} />
                <path d="M 90 55 Q 96 52 102 55" stroke="#2b1407" strokeWidth="2.2" strokeLinecap="round" fill="none" style={{
                  transform: isCoveringEyes ? 'translateY(-2px) rotate(-5deg)' : 'none',
                  transition: 'transform 0.3s ease'
                }} />

                {/* Eyes Area */}
                <g>
                  {/* Left Eye */}
                  {(!isCoveringEyes || (showPassword && isCoveringEyes)) ? (
                    <>
                      <ellipse cx="64" cy="65" rx="7.5" ry="8.5" fill="#ffffff" stroke="#e8d3c1" strokeWidth="0.8" />
                      <g style={{
                        transform: `translate(${pupilShift.x}px, ${pupilShift.y}px)`,
                        transition: 'transform 0.12s ease-out'
                      }}>
                        <circle cx="64" cy="65" r="4.8" fill="#1e0c04" />
                        <circle cx="62.5" cy="63" r="1.7" fill="#ffffff" />
                        <circle cx="65.5" cy="67" r="0.8" fill="#ffffff" />
                      </g>
                    </>
                  ) : (
                    <path d="M 56 66 Q 64 73 72 66" stroke="#2b1407" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  )}

                  {/* Right Eye */}
                  {!isCoveringEyes ? (
                    <>
                      <ellipse cx="96" cy="65" rx="7.5" ry="8.5" fill="#ffffff" stroke="#e8d3c1" strokeWidth="0.8" />
                      <g style={{
                        transform: `translate(${pupilShift.x}px, ${pupilShift.y}px)`,
                        transition: 'transform 0.12s ease-out'
                      }}>
                        <circle cx="96" cy="65" r="4.8" fill="#1e0c04" />
                        <circle cx="94.5" cy="63" r="1.7" fill="#ffffff" />
                        <circle cx="97.5" cy="67" r="0.8" fill="#ffffff" />
                      </g>
                    </>
                  ) : (
                    <path d="M 88 66 Q 96 73 104 66" stroke="#2b1407" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  )}
                </g>

                <ellipse cx="80" cy="71" rx="1.8" ry="1.2" fill="#d97706" />
                <path d={isCoveringEyes ? "M 74 78 Q 80 84 86 78" : isTypingUser ? "M 75 78 Q 80 82 85 78" : "M 74 78 Q 80 83 86 78"} stroke="#2b1407" strokeWidth="2" strokeLinecap="round" fill="none" />
              </g>

              {/* Animated Hands (Organic Chibi Hands Cupping Eyes) */}
              <g>
                <g style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'bottom center',
                  transform: isCoveringEyes 
                    ? (showPassword ? 'translate(-16px, 20px) rotate(-16deg)' : 'translateY(0px) rotate(0deg)')
                    : 'translateY(75px)',
                  opacity: isCoveringEyes ? 1 : 0,
                  transition: 'transform 0.45s cubic-bezier(0.34, 1.25, 0.64, 1), opacity 0.35s ease'
                }}>
                  {/* Sleeve */}
                  <path d="M 18 140 C 18 115 28 100 42 88 L 56 96 C 46 108 38 122 36 140 Z" fill="url(#lm-apron-grad)" stroke="#2b1407" strokeWidth="1.2" strokeLinejoin="round" />
                  {/* Rounded Cuff */}
                  <rect x="36" y="86" width="22" height="8" rx="4" transform="rotate(30 47 90)" fill="#ffffff" stroke="#ddbf9f" strokeWidth="0.9" />
                  {/* Hand with Rounded Chibi Fingers */}
                  <g transform="rotate(16 62 67)">
                    <path d="M 44 82 C 38 75 41 65 48 64 C 51 63 53 66 54 60 C 55 52 61 50 64 54 C 65 48 71 47 74 52 C 75 48 81 48 83 54 C 84 60 84 68 81 76 C 78 83 70 88 60 88 C 52 88 47 86 44 82 Z" fill="#fedac2" stroke="#d4936b" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M 54 62 L 55 70 M 64 56 L 65 72 M 73 54 L 74 72" stroke="#d4936b" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
                    <ellipse cx="63" cy="74" rx="7" ry="3.5" fill="#f87171" opacity="0.18" />
                  </g>
                </g>

                <g style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'bottom center',
                  transform: isCoveringEyes ? 'translateY(0px) rotate(0deg)' : 'translateY(75px)',
                  opacity: isCoveringEyes ? 1 : 0,
                  transition: 'transform 0.45s cubic-bezier(0.34, 1.25, 0.64, 1), opacity 0.35s ease'
                }}>
                  {/* Sleeve */}
                  <path d="M 142 140 C 142 115 132 100 118 88 L 104 96 C 114 108 122 122 124 140 Z" fill="url(#lm-apron-grad)" stroke="#2b1407" strokeWidth="1.2" strokeLinejoin="round" />
                  {/* Rounded Cuff */}
                  <rect x="102" y="86" width="22" height="8" rx="4" transform="rotate(-30 113 90)" fill="#ffffff" stroke="#ddbf9f" strokeWidth="0.9" />
                  {/* Hand with Rounded Chibi Fingers */}
                  <g transform="rotate(-16 98 67)">
                    <path d="M 116 82 C 122 75 119 65 112 64 C 109 63 107 66 106 60 C 105 52 99 50 96 54 C 95 48 89 47 86 52 C 85 48 79 48 77 54 C 76 60 76 68 79 76 C 82 83 90 88 100 88 C 108 88 113 86 116 82 Z" fill="#fedac2" stroke="#d4936b" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M 106 62 L 105 70 M 96 56 L 95 72 M 87 54 L 86 72" stroke="#d4936b" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
                    <ellipse cx="97" cy="74" rx="7" ry="3.5" fill="#f87171" opacity="0.18" />
                  </g>
                </g>
              </g>
            </svg>
          </div>

          <h2 className="text-xl font-black text-[#3d2617] tracking-tight">
            Ketoko<span className="text-[#96633b]">POS</span>
          </h2>
          <p className="text-xs text-[#8a6b53] mt-0.5 font-medium">Sistem Kasir & Toko • Cabang Samarinda (BR-01)</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#fbeeed] border border-[#f4cfcf] text-rose-700 text-xs flex items-center space-x-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Role Selection Buttons */}
        <div className="mb-5 space-y-2">
          <div className="text-[11px] font-bold text-[#8a6b53] uppercase tracking-wider text-center">
            Pilih Akun Petugas:
          </div>
          
          <div className="grid grid-cols-2 gap-2.5">
            {/* Kasir Quick Button */}
            <button
              type="button"
              onClick={() => handleSelectQuickAccount('noor')}
              className={`p-3 rounded-2xl border text-left transition-all group flex flex-col justify-between shadow-2xs ${
                username === 'noor' 
                  ? 'border-[#96633b] bg-[#faebd7]/70 ring-2 ring-[#96633b]/30' 
                  : 'border-[#ddc3aa] bg-white hover:bg-[#f5ebe0]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="p-1 rounded-lg bg-[#96633b] text-white">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold bg-[#faebd7] text-[#96633b] px-1.5 py-0.5 rounded border border-[#eed7c4]">
                  KASIR
                </span>
              </div>
              <div>
                <div className="font-bold text-xs text-[#3d2617]">Noor Afifah</div>
                <div className="text-[10px] text-[#96633b] leading-tight">Kasir • Operator POS</div>
              </div>
            </button>

            {/* Admin Quick Button */}
            <button
              type="button"
              onClick={() => handleSelectQuickAccount('suciawati')}
              className={`p-3 rounded-2xl border text-left transition-all group flex flex-col justify-between shadow-2xs ${
                username === 'suciawati' 
                  ? 'border-[#83532e] bg-[#faebd7]/70 ring-2 ring-[#83532e]/30' 
                  : 'border-[#ddc3aa] bg-white hover:bg-[#f5ebe0]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="p-1 rounded-lg bg-[#83532e] text-amber-200">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold bg-[#83532e] text-amber-200 px-1.5 py-0.5 rounded">
                  ADMIN
                </span>
              </div>
              <div>
                <div className="font-bold text-xs text-[#3d2617]">suciawati Ramadhani</div>
                <div className="text-[10px] text-[#96633b] leading-tight">Owner Toko • Admin</div>
              </div>
            </button>
          </div>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#ddc3aa]" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold text-[#8a6b53]">
            <span className="bg-[#fcf9f5] px-2">Masukkan Kata Sandi</span>
          </div>
        </div>

        {/* Manual Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-[#5c3c26] mb-1 block">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a6b53]">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onFocus={() => {
                  setIsTypingUser(true);
                  setIsCoveringEyes(false);
                  handleUsernameChange(username);
                }}
                onBlur={() => {
                  setIsTypingUser(false);
                  setPupilShift({ x: 0, y: 0, rot: 0 });
                }}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
                className="w-full pl-9 pr-4 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b] focus:ring-1 focus:ring-[#96633b] placeholder:text-[#8a6b53] font-medium"
                placeholder="Username (e.g. suciawati / noor / superadmin)"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#5c3c26] mb-1 block">Kata Sandi (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a6b53]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onFocus={() => {
                  setIsCoveringEyes(true);
                  setIsTypingUser(false);
                  setPupilShift({ x: 0, y: 0, rot: 0 });
                }}
                onBlur={() => {
                  setIsCoveringEyes(false);
                }}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-10 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs focus:bg-white focus:border-[#96633b] focus:ring-1 focus:ring-[#96633b] placeholder:text-[#8a6b53]"
                placeholder={username ? `Masukkan kata sandi untuk ${username}...` : "••••••••••••"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8a6b53] hover:text-[#5c3c26] transition-colors"
                title={showPassword ? "Sembunyikan Password" : "Lihat Password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#96633b] hover:bg-[#83532e] text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 text-xs transition-all active:scale-95"
          >
            <LogIn className="w-4 h-4 text-amber-200" />
            <span>{isLoading ? 'Memverifikasi...' : 'Masuk Aplikasi'}</span>
          </button>
        </form>

      </div>
    </div>
  );
};
