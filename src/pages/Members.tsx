import { useEffect, useState } from 'react';
import { supabase, DbUser, Division, DivisionRank } from '@/lib/supabase';
import { Search, Users, Shield, Award, Clock, Compass, X, ChevronRight } from 'lucide-react';

interface MemberWithDetails extends DbUser {
  division_name: string | null;
  division_rank_name: string | null;
  military_points: number;
}

export function Members() {
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberWithDetails | null>(null);
  const [divisions, setDivisions] = useState<Map<string, Division>>(new Map());
  const [ranks, setRanks] = useState<Map<string, DivisionRank>>(new Map());

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
      const { data: pts } = await supabase.rpc('get_user_military_points', { p_user_id: u.id });
      const memberInfo = memberMap.get(u.id);
      enriched.push({
        ...u,
        division_name: memberInfo ? divMap.get(memberInfo.division_id)?.name || null : null,
        division_rank_name: memberInfo && memberInfo.rank_id ? rankMap.get(memberInfo.rank_id)?.name || null : null,
        military_points: pts || 0,
      });
    }

    setMembers(enriched);
    setLoading(false);
  };

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.roblox_username.toLowerCase().includes(q) ||
      (m.roblox_display_name || '').toLowerCase().includes(q) ||
      m.group_rank_name.toLowerCase().includes(q) ||
      (m.division_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          Military Profiles
        </h1>
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
      </div>

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
                  alt={m.roblox_display_name}
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
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}

function MemberModal({ member, onClose }: { member: MemberWithDetails; onClose: () => void }) {
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
              alt={member.roblox_display_name}
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
          <Row icon={Award} label="Military Points" value={String(member.military_points)} />
          <Row icon={Clock} label="Timezone" value={member.timezone || 'Not set'} />
          <Row icon={Compass} label="Selected Path" value={member.selected_path || 'Not set'} />
          <Row icon={Shield} label="Main Sub" value={member.main_sub || 'Not set'} />
          <Row icon={Users} label="Division" value={member.division_name || 'Unassigned'} />
        </div>
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
