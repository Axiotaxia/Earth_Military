import { useEffect, useState } from 'react';
import { supabase, DbUser, Division, DivisionRank, DivisionMember } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/lib/permissions';
import {
  Search, X, Save, Loader2, Users, Shield, ArrowUp, Check,
} from 'lucide-react';

export function Promotions() {
  const { user } = useAuth();
  const perms = usePermissions();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDiv, setSelectedDiv] = useState<Division | null>(null);
  const [ranks, setRanks] = useState<DivisionRank[]>([]);
  const [members, setMembers] = useState<(DivisionMember & { user: DbUser; rank: DivisionRank | null })[]>([]);
  const [search, setSearch] = useState('');
  const [promoting, setPromoting] = useState<(DivisionMember & { user: DbUser; rank: DivisionRank | null }) | null>(null);
  const [newRankId, setNewRankId] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const restrictedToOwnDivision = user?.promote_scope === 'division_only';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('divisions').select('*').order('name');
      let visibleDivisions = data || [];

      // Division-only promoters can only see and act within their own division
      if (restrictedToOwnDivision && user?.division_id) {
        visibleDivisions = visibleDivisions.filter((d) => d.id === user.division_id);
      }

      setDivisions(visibleDivisions);
      if (visibleDivisions.length > 0) setSelectedDiv(visibleDivisions[0]);
    })();
  }, [restrictedToOwnDivision, user?.division_id]);

  useEffect(() => {
    if (!selectedDiv) return;
    (async () => {
      const { data: r } = await supabase
        .from('division_ranks')
        .select('*')
        .eq('division_id', selectedDiv.id)
        .order('hierarchy', { ascending: false });
      setRanks(r || []);

      const { data: dm } = await supabase
        .from('division_members')
        .select('*')
        .eq('division_id', selectedDiv.id);

      const memberUserIds = (dm || []).map((m) => m.user_id);
      const userMap = new Map<string, DbUser>();
      if (memberUserIds.length > 0) {
        const { data: mu } = await supabase.from('users').select('*').in('id', memberUserIds);
        (mu || []).forEach((u) => userMap.set(u.id, u));
      }
      const rankMap = new Map<string, DivisionRank>();
      (r || []).forEach((rk) => rankMap.set(rk.id, rk));

      const enriched = (dm || []).map((m) => ({
        ...m,
        user: userMap.get(m.user_id)!,
        rank: m.division_rank_id ? rankMap.get(m.division_rank_id) || null : null,
      })).filter((m) => m.user);

      setMembers(enriched);
    })();
  }, [selectedDiv]);

  if (!perms.can_promote) {
    return (
      <div className="ek-panel p-12 text-center">
        <Shield className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">You do not have permission to access the promotion menu.</p>
      </div>
    );
  }

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.user.roblox_username.toLowerCase().includes(q) ||
      (m.user.roblox_display_name || '').toLowerCase().includes(q)
    );
  });

  // Promotion eligibility:
  // - Owners and global promoters (user_permissions or group-rank granted) can promote
  //   anyone with a lower Roblox group rank, in any division.
  // - Division-only promoters (permission granted solely via their division rank) only
  //   ever see their own division here (the division list above is pre-filtered), so
  //   this just checks the group-rank requirement.
  const canPromoteMember = (m: { user: DbUser; rank: DivisionRank | null }) => {
    if (!user) return false;
    if (user.is_owner) return true;
    return m.user.group_rank < user.group_rank;
  };

  const handlePromote = async () => {
    if (!promoting || !newRankId) return;
    setSaving(true);
    const { error } = await supabase
      .from('division_members')
      .update({ division_rank_id: newRankId })
      .eq('id', promoting.id);

    if (!error) {
      await supabase.from('activity_log').insert({
        user_id: promoting.user_id,
        event_type: 'promotion',
        event_data: {
          division_id: promoting.division_id,
          new_rank_id: newRankId,
          promoted_by: user!.id,
        },
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setPromoting(null);
        setNewRankId('');
        // Reload
        if (selectedDiv) {
          (async () => {
            const { data: dm } = await supabase
              .from('division_members')
              .select('*')
              .eq('division_id', selectedDiv.id);
            const memberUserIds = (dm || []).map((m) => m.user_id);
            const userMap = new Map<string, DbUser>();
            if (memberUserIds.length > 0) {
              const { data: mu } = await supabase.from('users').select('*').in('id', memberUserIds);
              (mu || []).forEach((u) => userMap.set(u.id, u));
            }
            const rankMap = new Map<string, DivisionRank>();
            ranks.forEach((rk) => rankMap.set(rk.id, rk));
            setMembers((dm || []).map((m) => ({
              ...m,
              user: userMap.get(m.user_id)!,
              rank: m.division_rank_id ? rankMap.get(m.division_rank_id) || null : null,
            })).filter((m) => m.user));
          })();
        }
      }, 1500);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
        Promotion Menu
      </h1>
      <p className="text-sm text-stone-400">
        You can only promote members with lower group rank. Division ranks only — Roblox group ranks cannot be changed here.
        {restrictedToOwnDivision && ' You can only promote or demote members within your own division.'}
      </p>

      {/* Division selector — hidden when there's only one division to act in */}
      {divisions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {divisions.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDiv(d)}
              className={`ek-btn text-sm ${selectedDiv?.id === d.id ? 'ek-btn-primary' : 'ek-btn-ghost'}`}
            >
              {d.icon} {d.name}
            </button>
          ))}
        </div>
      )}

      {divisions.length === 0 && (
        <div className="ek-panel p-12 text-center">
          <Shield className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400">
            {restrictedToOwnDivision
              ? 'You are not currently assigned to a division.'
              : 'No divisions have been created yet.'}
          </p>
        </div>
      )}

      {selectedDiv && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="ek-input pl-9 w-full max-w-xs"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="ek-panel p-12 text-center">
              <Users className="w-12 h-12 text-stone-600 mx-auto mb-3" />
              <p className="text-stone-400">No members in this division.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => (
                <div key={m.id} className="ek-panel p-4 flex items-center gap-4">
                  {m.user.roblox_avatar_url ? (
                    <img src={m.user.roblox_avatar_url} alt="" className="w-10 h-10 rounded-full border border-stone-600" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center"><Users className="w-5 h-5 text-stone-400" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-100 truncate">{m.user.roblox_display_name || m.user.roblox_username}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-stone-500">{m.user.group_rank_name}</span>
                      {m.rank && <span className="text-xs text-amber-500">→ {m.rank.name}</span>}
                    </div>
                  </div>
                  {canPromoteMember(m) ? (
                    <button
                      onClick={() => { setPromoting(m); setNewRankId(m.rank?.id || ''); }}
                      className="ek-btn ek-btn-gold text-sm flex items-center gap-1.5"
                    >
                      <ArrowUp className="w-3.5 h-3.5" /> Promote
                    </button>
                  ) : (
                    <span className="text-xs text-stone-500">Same/higher rank</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Promotion modal */}
      {promoting && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPromoting(null)}>
          <div className="ek-panel max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-amber-400">Promote {promoting.user.roblox_display_name || promoting.user.roblox_username}</h2>
              <button onClick={() => setPromoting(null)} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-stone-400 mb-4">
              Current rank: <span className="text-stone-200">{promoting.rank?.name || 'Unranked'}</span>
            </p>
            <label className="ek-label">New Division Rank</label>
            <select value={newRankId} onChange={(e) => setNewRankId(e.target.value)} className="ek-input w-full">
              <option value="">Select new rank...</option>
              {ranks.map((r) => <option key={r.id} value={r.id}>{r.name} (H{r.hierarchy})</option>)}
            </select>
            <button
              onClick={handlePromote}
              disabled={saving || !newRankId}
              className="ek-btn ek-btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : success ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {success ? 'Promoted!' : 'Confirm Promotion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
