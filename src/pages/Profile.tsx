import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, TIMEZONES, PATHS, PointTransaction, Division, DivisionRank } from '@/lib/supabase';
import {
  Shield, Clock, Compass, Award, Users, Save, Loader2, Check, History,
} from 'lucide-react';

export function Profile() {
  const { user, refreshUser } = useAuth();
  const [timezone, setTimezone] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [mainSub, setMainSub] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [militaryPoints, setMilitaryPoints] = useState(0);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [division, setDivision] = useState<Division | null>(null);
  const [divisionRank, setDivisionRank] = useState<DivisionRank | null>(null);

  useEffect(() => {
    if (!user) return;
    setTimezone(user.timezone || '');
    setSelectedPath(user.selected_path || '');
    setMainSub(user.main_sub || '');

    (async () => {
      const { data: pts } = await supabase.rpc('get_user_military_points', { p_user_id: user.id });
      setMilitaryPoints(pts || 0);

      const { data: txns } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setTransactions(txns || []);

      const { data: member } = await supabase
        .from('division_members')
        .select('division_id, division_rank_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (member?.division_id) {
        const { data: div } = await supabase.from('divisions').select('*').eq('id', member.division_id).maybeSingle();
        setDivision(div);
      }
      if (member?.division_rank_id) {
        const { data: rank } = await supabase.from('division_ranks').select('*').eq('id', member.division_rank_id).maybeSingle();
        setDivisionRank(rank);
      }
    })();
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from('users')
      .update({
        timezone,
        selected_path: selectedPath,
        main_sub: mainSub,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (!error) {
      setSaved(true);
      await refreshUser();
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile header */}
      <div className="ek-panel overflow-hidden">
        <div className="bg-gradient-to-r from-green-900/30 to-transparent p-6 flex items-center gap-5">
          {user.roblox_avatar_url ? (
            <img
              src={user.roblox_avatar_url}
              alt={user.roblox_display_name || undefined}
              className="w-24 h-24 rounded-full border-2 border-amber-600/40 shadow-lg"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-stone-700 flex items-center justify-center border-2 border-amber-600/40">
              <Users className="w-12 h-12 text-stone-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
              {user.roblox_display_name || user.roblox_username}
            </h1>
            <p className="text-stone-400 text-sm">@{user.roblox_username}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="ek-badge bg-green-900/50 text-green-400 border border-green-700/50">
                {user.group_rank_name}
              </span>
              {division && (
                <span className="ek-badge bg-amber-900/40 text-amber-400 border border-amber-700/40">
                  {division.name}
                </span>
              )}
              {divisionRank && (
                <span className="ek-badge bg-stone-700/50 text-stone-300 border border-stone-600/50">
                  {divisionRank.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="ek-panel p-4 text-center">
          <Award className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-stone-100">{militaryPoints}</p>
          <p className="text-xs text-stone-500 uppercase tracking-wider">Military Points</p>
        </div>
        <div className="ek-panel p-4 text-center">
          <Shield className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-100">{user.group_rank_name}</p>
          <p className="text-xs text-stone-500 uppercase tracking-wider">Group Rank</p>
        </div>
        <div className="ek-panel p-4 text-center">
          <Compass className="w-6 h-6 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-100">{divisionRank?.name || 'None'}</p>
          <p className="text-xs text-stone-500 uppercase tracking-wider">Division Rank</p>
        </div>
      </div>

      {/* Editable fields */}
      <div className="ek-panel p-6">
        <h2 className="ek-section-title">Edit Profile</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="ek-label flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Timezone
            </label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="ek-input w-full">
              <option value="">Select timezone...</option>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="ek-label flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" /> Selected Path
            </label>
            <select value={selectedPath} onChange={(e) => setSelectedPath(e.target.value)} className="ek-input w-full">
              <option value="">Select path...</option>
              {PATHS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="ek-label flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Main Sub
            </label>
            <input
              type="text"
              value={mainSub}
              onChange={(e) => setMainSub(e.target.value)}
              placeholder="Your main subdivision"
              className="ek-input w-full"
              maxLength={100}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={handleSave} disabled={saving} className="ek-btn ek-btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
          {saved && (
            <span className="text-green-400 text-sm flex items-center gap-1 animate-fade-in">
              <Check className="w-4 h-4" /> Saved successfully
            </span>
          )}
        </div>
      </div>

      {/* Points history */}
      <div className="ek-panel p-6">
        <h2 className="ek-section-title flex items-center gap-2">
          <History className="w-4 h-4" /> Points History
        </h2>
        {transactions.length === 0 ? (
          <p className="text-stone-500 text-sm text-center py-6">No point transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-stone-800/50 rounded-md border border-stone-700/50">
                <div>
                  <p className="text-sm text-stone-200">{t.reason}</p>
                  <p className="text-xs text-stone-500">{new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-sm font-bold ${t.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.points >= 0 ? '+' : ''}{t.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
