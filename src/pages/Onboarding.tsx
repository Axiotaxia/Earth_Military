import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, TIMEZONES, PATHS } from '@/lib/supabase';
import { Mountain, Clock, Compass, Shield, Loader2, Check } from 'lucide-react';

export function Onboarding() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [timezone, setTimezone] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [mainSub, setMainSub] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const steps = ['Timezone', 'Selected Path', 'Main Sub'];

  const handleSave = async () => {
    if (!timezone || !selectedPath || !mainSub) {
      setError('Please fill in all fields.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        timezone,
        selected_path: selectedPath,
        main_sub: mainSub,
        onboarded: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await supabase.from('activity_log').insert({
      user_id: user.id,
      event_type: 'onboarding_complete',
      event_data: { timezone, selected_path: selectedPath, main_sub },
    });

    await refreshUser();
    setSaving(false);
    navigate('/dashboard');
  };

  const handleNext = () => {
    if (step === 0 && !timezone) { setError('Please select a timezone.'); return; }
    if (step === 1 && !selectedPath) { setError('Please select a path.'); return; }
    setError(null);
    if (step < 2) setStep(step + 1);
    else handleSave();
  };

  return (
    <div className="min-h-screen bg-stone-950 relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900 via-green-950 to-stone-950" />

      <div className="relative z-10 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-900 items-center justify-center ring-4 ring-amber-600/30 mb-3">
            <Mountain className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-amber-400 mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
            Welcome, {user.roblox_display_name || user.roblox_username}
          </h1>
          <p className="text-stone-400 text-sm">Complete your enlistment profile</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? 'bg-green-600 text-white' :
                i === step ? 'bg-amber-600 text-white ring-4 ring-amber-600/20' :
                'bg-stone-700 text-stone-400'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`w-12 h-0.5 ${i < step ? 'bg-green-600' : 'bg-stone-700'}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="ek-panel p-6 animate-scale-in">
          {step === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-stone-200">Select Your Timezone</h2>
              </div>
              <p className="text-stone-400 text-sm mb-4">
                This helps schedule raids, trainings, and events at times that work for you.
              </p>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="ek-input w-full"
              >
                <option value="">Choose your timezone...</option>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Compass className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-stone-200">Choose Your Path</h2>
              </div>
              <p className="text-stone-400 text-sm mb-4">
                Select your military specialization within the Earth Kingdom.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PATHS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPath(p)}
                    className={`p-3 rounded-md text-sm font-medium border transition-all ${
                      selectedPath === p
                        ? 'bg-green-700/30 border-green-500 text-green-400'
                        : 'bg-stone-800/50 border-stone-700 text-stone-400 hover:border-stone-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-stone-200">Main Sub</h2>
              </div>
              <p className="text-stone-400 text-sm mb-4">
                Enter your main subdivision or specialization within your chosen path.
              </p>
              <input
                type="text"
                value={mainSub}
                onChange={(e) => setMainSub(e.target.value)}
                placeholder="e.g., Heavy Infantry, Scout Division..."
                className="ek-input w-full"
                maxLength={100}
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

          {/* Actions */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : null}
              className="ek-btn ek-btn-ghost"
              disabled={step === 0}
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={saving}
              className="ek-btn ek-btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {step === 2 ? 'Complete' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
