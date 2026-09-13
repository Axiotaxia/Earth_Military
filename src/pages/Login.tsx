import { Link } from 'react-router-dom';
import { Shield, Mountain, Swords, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Login() {
  const { loginWithRoblox } = useAuth();

  return (
    <div className="min-h-screen bg-stone-950 relative overflow-hidden flex items-center justify-center px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-green-950 to-stone-950" />
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(45, 122, 45, 0.3) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, rgba(184, 125, 24, 0.15) 0%, transparent 50%)`
        }}
      />

      {/* Mountain silhouette decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-10">
        <svg viewBox="0 0 1200 300" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,300 L0,150 L150,80 L300,140 L450,60 L600,120 L750,40 L900,100 L1050,70 L1200,130 L1200,300 Z"
                fill="#2d7a2d" />
          <path d="M0,300 L0,200 L100,140 L250,180 L400,120 L550,160 L700,100 L850,140 L1000,110 L1200,170 L1200,300 Z"
                fill="#1a4d1a" />
        </svg>
      </div>

      <div className="relative z-10 max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-green-900 items-center justify-center ring-4 ring-amber-600/30 mb-4 shadow-2xl shadow-green-900/50">
            <Shield className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-amber-400 mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
            Earth Kingdom
          </h1>
          <p className="text-stone-400 text-sm uppercase tracking-[0.3em]">Military Command</p>
        </div>

        {/* Login panel */}
        <div className="ek-panel p-8 animate-scale-in shadow-2xl">
          <p className="text-stone-300 text-center mb-6 leading-relaxed">
            Sign in with your Roblox account to access the Earth Kingdom military management system.
          </p>

          <button
            onClick={loginWithRoblox}
            className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-3 text-base py-3 mb-4"
          >
            <Shield className="w-5 h-5" />
            Sign in with Roblox
          </button>

          <div className="flex items-center justify-center gap-4 text-xs text-stone-500 mt-6 pt-6 border-t border-stone-700/50">
            <Link to="/Service" className="hover:text-amber-400 transition-colors">Terms of Service</Link>
            <span className="text-stone-700">|</span>
            <Link to="/Privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex items-center justify-center gap-6 mt-6 text-stone-500 text-xs">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Group Members
          </div>
          <div className="flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5" /> Divisions
          </div>
          <div className="flex items-center gap-1.5">
            <Mountain className="w-3.5 h-3.5" /> Earth Kingdom
          </div>
        </div>
      </div>
    </div>
  );
}
