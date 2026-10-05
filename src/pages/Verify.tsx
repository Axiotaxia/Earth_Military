import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Verify() {
  const { loginWithRoblox } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const success = searchParams.get('success') === '1';

  useEffect(() => {
    if (!success && token) {
      // Keep the verification token in the URL/state only until Roblox OAuth
      // begins. The token is single-use and expires shortly after creation.
    }
  }, [success, token]);

  if (success) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full ek-panel p-8 text-center animate-scale-in">
          <div className="inline-flex w-16 h-16 rounded-full bg-green-900/30 items-center justify-center ring-2 ring-green-700/30 mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-amber-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
            Verification Complete
          </h1>
          <p className="text-stone-400 text-sm leading-relaxed">
            Your Roblox and Discord accounts have been linked. Your Military Discord role and nickname will be updated automatically.
          </p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full ek-panel p-8 text-center animate-scale-in">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-stone-100 mb-2">Verification Link Missing</h1>
          <p className="text-stone-400 text-sm leading-relaxed">
            Use the Verify button in the Military Discord server to generate your personal verification link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full ek-panel p-8 text-center animate-scale-in">
        <div className="inline-flex w-16 h-16 rounded-full bg-green-900/30 items-center justify-center ring-2 ring-green-700/30 mb-4">
          <Shield className="w-9 h-9 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-amber-400 mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
          Verify Military Account
        </h1>
        <p className="text-stone-400 text-sm leading-relaxed mb-6">
          Continue with Roblox to confirm that your Roblox account is Private or above and link it to your Discord account.
        </p>
        <button
          onClick={() => loginWithRoblox(token)}
          className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-3 text-base py-3"
        >
          <Shield className="w-5 h-5" />
          Continue with Roblox
        </button>
        <p className="text-xs text-stone-600 mt-4">
          This verification link is single-use and expires shortly.
        </p>
      </div>
    </div>
  );
}
