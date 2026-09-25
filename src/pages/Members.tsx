import { useEffect, useMemo, useState } from 'react';
import {
  supabase, DbUser, Division, DivisionRank, ROBLOX_RANKS, TIMEZONES, PATHS, SUBS, PointTransaction,
} from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Search, Users, Shield, Award, Clock, Compass, X, ChevronRight, Filter, RotateCcw,
  Save, Loader2, Check, UserMinus, History,
} from 'lucide-react';

interface MemberWithDetails extends DbUser {
  division_name: string | null;
  division_rank_name: string | null;
  military_points: number;
  recent_points: number;
}

interface DivisionMembership {
  membershipId: string;
  divisionId: string;
  divisionRankId: string | null;
}

const EMPTY_FILTERS = {
  sub: '',
  timezone: '',
  divisionId: '',
  robloxRank: '',
  divisionRankId: '',
  path: '',
};

export function Members() {
  const perms = usePermissions();
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberWithDetails | null>(null);
  const [divisions, setDivisions] = useState<Map<string, Division>>(new Map());
  const [ranks, setRanks] = useState<Map<string, DivisionRank>>(new Map());
  const [memberDivisionRankId, setMemberDivisionRankId] = useState<Map<string, string>>(new Map());
  const [membershipByUser, setMembershipByUser] = useState<Map<string, DivisionMembership>>(new Map());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .order('group_rank', { ascending: false });

    const { data: divs } = await supabase.from('divisions').select('*');
    const { data: allRanks } = await supabase.from('division_ranks').select('*');
    const { data: allMembers } = await supabase.from('division_members').select('*');

    const divMap = new Map<string, Division>();
    divs?.forEach((d) => divMap.set(d.id, d));
    setDivisions(divMap);

    const rankMap = new Map<string, DivisionRank>();
    allRanks?.forEach((r) => rankMap.set(r.id, r));
    setRanks(rankMap);

    const memberMap = new Map<string, { division_id: string; rank_id: string }>();
    allMembers?.forEach((m) => memberMap.set(m.user_id, { division_id: m.division_id, rank_id: m.division_rank_id }));

    // Get points for all users
    const enriched: MemberWithDetails[] = [];
    for (const u of users || []) {
      const [{ data: pts }, { data: recentPts }] = await Promise.all([
        supabase.rpc('get_user_military_points', { p_user_id: u.id }),
        supabase.rpc('get_user_recent_points', { p_user_id: u.id }),
      ]);
      const memberInfo = memberMap.get(u.id);
      enriched.push({
        ...u,
        division_name: memberInfo ? divMap.get(memberInfo.division_id)?.name || null : null,
        division_rank_name: memberInfo && memberInfo.rank_id ? rankMap.get(memberInfo.rank_id)?.name || null : null,
        military_points: pts || 0,
        recent_points: recentPts || 0,
      });
    }

    setMemberDivisionRankId(new Map(allMembers?.map((m) => [m.user_id, m.division_rank_id || '']) || []));
    setMembershipByUser(new Map((allMembers || []).map((m) => [m.user_id, {
      membershipId: m.id,
      divisionId: m.division_id,
      divisionRankId: m.division_rank_id,
    }])));
    setMembers(enriched);
    setLoading(false);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filtered = useMemo(() => members.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      m.roblox_username.toLowerCase().includes(q) ||
      (m.roblox_display_name || '').toLowerCase().includes(q) ||
      m.group_rank_name.toLowerCase().includes(q) ||
      (m.division_name || '').toLowerCase().includes(q)
    );
    if (!matchesSearch) return false;

    if (filters.sub && m.main_sub !== filters.sub) return false;
    if (filters.timezone && m.timezone !== filters.timezone) return false;
    if (filters.path && m.selected_path !== filters.path) return false;
    if (filters.robloxRank && String(m.group_rank) !== filters.robloxRank) return false;
    if (filters.divisionId) {
      const memberDivName = m.division_name;
      const filterDivName = divisions.get(filters.divisionId)?.name;
      if (!memberDivName || memberDivName !== filterDivName) return false;
    }
    if (filters.divisionRankId && memberDivisionRankId.get(m.id) !== filters.divisionRankId) return false;

    return true;
  }), [members, search, filters, divisions, memberDivisionRankId]);

  const divisionRankOptions = Array.from(ranks.values()).sort((a, b) => a.name.localeCompare(b.name));
  const divisionOptions = Array.from(divisions.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          Military Profiles
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="ek-input pl-9 w-64"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`ek-btn text-sm flex items-center gap-2 ${showFilters || activeFilterCount > 0 ? 'ek-btn-primary' : 'ek-btn-ghost'}`}
          >
            <Filter className="w-4 h-4" /> Filters
            {activeFilterCount > 0 && (
              <span className="ek-badge bg-stone-900/60 text-xs">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="ek-panel p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="ek-label">Sub</label>
            <select value={filters.sub} onChange={(e) => setFilters({ ...filters, sub: e.target.value })} className="ek-input w-full">
              <option value="">All</option>
              {SUBS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="ek-label">Timezone</label>
            <select value={filters.timezone} onChange={(e) => setFilters({ ...filters, timezone: e.target.value })} className="ek-input w-full">
              <option value="">All</option>
              {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="ek-label">Division</label>
            <select value={filters.divisionId} onChange={(e) => setFilters({ ...filters, divisionId: e.target.value })} className="ek-input w-full">
              <option value="">All</option>
              {divisionOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="ek-label">Roblox Rank</label>
            <select value={filters.robloxRank} onChange={(e) => setFilters({ ...filters, robloxRank: e.target.value })} className="ek-input w-full">
              <option value="">All</option>
              {ROBLOX_RANKS.map((r) => <option key={r.rank} value={String(r.rank)}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="ek-label">Division Rank</label>
            <select value={filters.divisionRankId} onChange={(e) => setFilters({ ...filters, divisionRankId: e.target.value })} className="ek-input w-full">
              <option value="">All</option>
              {divisionRankOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="ek-label">Selected Path</label>
            <select value={filters.path} onChange={(e) => setFilters({ ...filters, path: e.target.value })} className="ek-input w-full">
              <option value="">All</option>
              {PATHS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="ek-btn ek-btn-ghost text-sm flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-stone-500">Loading members...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-stone-500">No members found.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMember(m)}
              className="ek-panel p-4 flex items-center gap-4 hover:border-green-700/50 transition-all text-left group"
            >
              {m.roblox_avatar_url ? (
                <img
                  src={m.roblox_avatar_url}
                  alt={m.roblox_display_name || undefined}
                  className="w-12 h-12 rounded-full border border-stone-600 flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-stone-700 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-stone-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-100 truncate">
                  {m.roblox_display_name || m.roblox_username}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="ek-badge bg-green-900/40 text-green-400 border border-green-800/40">
                    {m.group_rank_name}
                  </span>
                  {m.division_name && (
                    <span className="ek-badge bg-amber-900/30 text-amber-400 border border-amber-800/30">
                      {m.division_name}
                    </span>
                  )}
                  {m.division_rank_name && (
                    <span className="ek-badge bg-stone-700/40 text-stone-300 border border-stone-600/40">
                      {m.division_rank_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-amber-400">{m.military_points}</p>
                <p className="text-[10px] text-stone-500 uppercase">Points</p>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-600 group-hover:text-green-400 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* Member detail modal */}
      {selectedMember && (
        <MemberModal
          member={selectedMember}
          hasManagePermission={perms.can_manage_members}
          canManage={perms.can_manage_members && (perms.is_owner || (user ? selectedMember.group_rank < user.group_rank : false))}
          divisions={divisionOptions}
          allRanks={Array.from(ranks.values())}
          membership={membershipByUser.get(selectedMember.id) || null}
          onClose={() => setSelectedMember(null)}
          onChanged={loadMembers}
        />
      )}
    </div>
  );
}

function MemberModal({
  member, canManage, hasManagePermission, divisions, allRanks, membership, onClose, onChanged,
}: {
  member: MemberWithDetails;
  canManage: boolean;
  hasManagePermission: boolean;
  divisions: Division[];
  allRanks: DivisionRank[];
  membership: DivisionMembership | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [divisionId, setDivisionId] = useState(membership?.divisionId || '');
  const [divisionRankId, setDivisionRankId] = useState(membership?.divisionRankId || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<(PointTransaction & { awarded_by_user: DbUser | null })[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setTransactionsLoading(true);
      const { data: txns } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', member.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const awarderIds = Array.from(new Set((txns || []).map((t) => t.awarded_by).filter((id): id is string => !!id)));
      let awarderMap = new Map<string, DbUser>();
      if (awarderIds.length > 0) {
        const { data: awarders } = await supabase.from('users').select('*').in('id', awarderIds);
        awarderMap = new Map((awarders || []).map((a) => [a.id, a]));
      }

      setTransactions((txns || []).map((t) => ({
        ...t,
        awarded_by_user: t.awarded_by ? awarderMap.get(t.awarded_by) || null : null,
      })));
      setTransactionsLoading(false);
    })();
  }, [member.id]);

  const ranksForDivision = allRanks.filter((r) => r.division_id === divisionId);

  const handleAssign = async () => {
    if (!divisionId) { setError('Select a division first.'); return; }
    setSaving(true);
    setError(null);

    if (membership) {
      const { error: e } = await supabase
        .from('division_members')
        .update({ division_id: divisionId, division_rank_id: divisionRankId || null })
        .eq('id', membership.membershipId);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('division_members').insert({
        user_id: member.id,
        division_id: divisionId,
        division_rank_id: divisionRankId || null,
      });
      if (e) { setError(e.message); setSaving(false); return; }
    }

    setSaving(false);
    setSaved(true);
    onChanged();
    setTimeout(() => setSaved(false), 1500);
  };

  const handleRemoveFromDivision = async () => {
    if (!membership) return;
    if (!confirm('Remove this member from their division?')) return;
    setSaving(true);
    await supabase.from('division_members').delete().eq('id', membership.membershipId);
    setDivisionId('');
    setDivisionRankId('');
    setSaving(false);
    onChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="ek-panel max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
            Military Profile
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          {member.roblox_avatar_url ? (
            <img
              src={member.roblox_avatar_url}
              alt={member.roblox_display_name || undefined}
              className="w-16 h-16 rounded-full border-2 border-amber-600/40"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-stone-700 flex items-center justify-center">
              <Users className="w-8 h-8 text-stone-400" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-stone-100">
              {member.roblox_display_name || member.roblox_username}
            </h3>
            <p className="text-sm text-stone-500">@{member.roblox_username}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Row icon={Shield} label="Group Rank" value={member.group_rank_name} />
          <Row icon={Award} label="Division Rank" value={member.division_rank_name || 'None'} />
          <Row icon={Award} label="Total Points" value={String(member.military_points)} />
          <Row icon={Award} label="Recent Points (this cycle)" value={String(member.recent_points)} />
          <Row icon={Clock} label="Timezone" value={member.timezone || 'Not set'} />
          <Row icon={Compass} label="Selected Path" value={member.selected_path || 'Not set'} />
          <Row icon={Shield} label="Main Sub" value={member.main_sub || 'Not set'} />
          <Row icon={Users} label="Division" value={member.division_name || 'Unassigned'} />
        </div>

        <div className="mt-5 pt-5 border-t border-stone-700">
          <h4 className="ek-label mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Points History
          </h4>
          {transactionsLoading ? (
            <p className="text-stone-600 text-sm text-center py-4">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-stone-600 text-sm text-center py-4">No point transactions yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 bg-stone-800/50 rounded-md">
                  <div className="min-w-0">
                    <p className="text-sm text-stone-200 truncate">{t.reason}</p>
                    <p className="text-xs text-stone-500">
                      {new Date(t.created_at).toLocaleDateString()}
                      {t.awarded_by_user && (
                        <> &middot; by {t.awarded_by_user.roblox_display_name || t.awarded_by_user.roblox_username}</>
                      )}
                    </p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ml-2 ${t.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.points >= 0 ? '+' : ''}{t.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasManagePermission && !canManage && (
          <p className="mt-5 pt-5 border-t border-stone-700 text-xs text-stone-500">
            You can't assign this member to a division since their Roblox group rank is the same as or higher than yours.
          </p>
        )}

        {canManage && (
          <div className="mt-5 pt-5 border-t border-stone-700">
            <h4 className="ek-label mb-2">Assign to Division</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                value={divisionId}
                onChange={(e) => { setDivisionId(e.target.value); setDivisionRankId(''); }}
                className="ek-input w-full"
              >
                <option value="">Select division...</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={divisionRankId}
                onChange={(e) => setDivisionRankId(e.target.value)}
                className="ek-input w-full"
                disabled={!divisionId}
              >
                <option value="">No rank (unranked)</option>
                {ranksForDivision.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={handleAssign} disabled={saving} className="ek-btn ek-btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved!' : membership ? 'Update Assignment' : 'Assign'}
              </button>
              {membership && (
                <button onClick={handleRemoveFromDivision} disabled={saving} className="ek-btn ek-btn-danger flex items-center gap-2 text-sm">
                  <UserMinus className="w-4 h-4" /> Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-stone-800/50 rounded-md">
      <Icon className="w-4 h-4 text-stone-500" />
      <span className="text-sm text-stone-400 flex-1">{label}</span>
      <span className="text-sm font-medium text-stone-200">{value}</span>
    </div>
  );
}
