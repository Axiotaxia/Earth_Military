import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { OAuthCallback } from '@/pages/OAuthCallback';
import { Onboarding } from '@/pages/Onboarding';
import { Dashboard } from '@/pages/Dashboard';
import { Profile } from '@/pages/Profile';
import { Members } from '@/pages/Members';
import { Divisions } from '@/pages/Divisions';
import { DivisionDetail } from '@/pages/DivisionDetail';
import { DivisionRanks } from '@/pages/DivisionRanks';
import { Promotions } from '@/pages/Promotions';
import { Points } from '@/pages/Points';
import { HRPanel } from '@/pages/HRPanel';
import { AdminPanel } from '@/pages/AdminPanel';
import { DamageCalculator } from '@/pages/DamageCalculator';
import { Terms } from '@/pages/Terms';
import { Privacy } from '@/pages/Privacy';
import { MIN_SITE_ACCESS_RANK } from '@/lib/supabase';
import { Loader2, ShieldAlert } from 'lucide-react';

function RankLockedScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="min-h-screen bg-stone-950 relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-green-950 to-stone-950" />
      <div className="relative z-10 max-w-md w-full ek-panel p-8 text-center animate-scale-in">
        <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-red-900 to-stone-900 items-center justify-center ring-4 ring-red-700/30 mb-4">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-stone-100 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
          Rank Requirement Not Met
        </h1>
        <p className="text-stone-400 text-sm mb-1">
          You must hold the rank of <span className="text-amber-400 font-semibold">Private</span> or above in the Roblox group to access this site.
        </p>
        <p className="text-stone-500 text-sm mb-6">
          Your current rank: <span className="text-stone-300">{user.group_rank_name}</span>
        </p>
        <button onClick={logout} className="ek-btn ek-btn-ghost w-full">
          Log Out
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  if (user.group_rank < MIN_SITE_ACCESS_RANK) return <RankLockedScreen />;

  if (!user.onboarded) return <Navigate to="/onboarding" replace />;

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (user && user.group_rank < MIN_SITE_ACCESS_RANK) return <RankLockedScreen />;
  if (user && user.onboarded) return <Navigate to="/dashboard" replace />;
  if (user && !user.onboarded) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function OnboardingRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (user.onboarded) return <Navigate to="/dashboard" replace />;

  return <Onboarding />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/redirect" element={<OAuthCallback />} />
      <Route path="/Service" element={<Terms />} />
      <Route path="/Privacy" element={<Privacy />} />

      {/* Onboarding */}
      <Route path="/onboarding" element={<OnboardingRoute />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
      <Route path="/divisions" element={<ProtectedRoute><Divisions /></ProtectedRoute>} />
      <Route path="/divisions/:id" element={<ProtectedRoute><DivisionDetail /></ProtectedRoute>} />
      <Route path="/division-ranks" element={<ProtectedRoute><DivisionRanks /></ProtectedRoute>} />
      <Route path="/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
      <Route path="/points" element={<ProtectedRoute><Points /></ProtectedRoute>} />
      <Route path="/hr-panel" element={<ProtectedRoute><HRPanel /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
      <Route path="/damage-calculator" element={<ProtectedRoute><DamageCalculator /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
