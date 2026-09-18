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
import { Terms } from '@/pages/Terms';
import { Privacy } from '@/pages/Privacy';
import { Loader2 } from 'lucide-react';

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
