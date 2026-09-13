import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

export function OAuthCallback() {
  const { handleOAuthCallback } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const code = searchParams.get('code');
    const err = searchParams.get('error');

    if (err) {
      setError(`Roblox authorization failed: ${err}`);
      return;
    }

    if (!code) {
      setError('No authorization code received from Roblox.');
      return;
    }

    handleOAuthCallback(code)
      .then(() => navigate('/dashboard'))
      .catch((e) => setError(e.message || 'Authentication failed'));
  }, [searchParams, handleOAuthCallback, navigate]);

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full ek-panel p-8 text-center animate-scale-in">
        {error ? (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-400 mb-2">Authentication Failed</h2>
            <p className="text-stone-400 text-sm mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="ek-btn ek-btn-primary"
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <div className="inline-flex w-16 h-16 rounded-full bg-green-900/30 items-center justify-center ring-2 ring-green-700/30 mb-4">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-stone-200 mb-2">Authenticating...</h2>
            <p className="text-stone-500 text-sm">Verifying your Roblox identity with the Earth Kingdom.</p>
          </>
        )}
      </div>
    </div>
  );
}
