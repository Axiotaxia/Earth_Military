import { useEffect, useState, useMemo } from 'react';
import { supabase, DbUser, Division, DivisionRank, DivisionMember, ActivityLog, ROBLOX_RANKS } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import {
  BarChart3, Users, TrendingUp, Clock, Compass, Shield, Award, Activity,
} from 'lucide-react';

type Period = 7 | 14 | 30;

interface UserActivity {
  user: DbUser;
  activityCount: number;
}

interface DivisionStat {
  division: Division;
  memberCount: number;
  ranks: DivisionRank[];
}

export function HRPanel() {
  const perms = usePermissions();
  const [period, setPeriod] = useState<Period>(7);
  const [allUsers, setAllUsers] = useState<DbUser[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [divisionMembers, setDivisionMembers] = useState<DivisionMember[]>([]);
  const [divisionRanks, setDivisionRanks] = useState<DivisionRank[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [usersRes, divsRes, dmRes, ranksRes] = await Promise.all([
        supabase.from('users').select('*').order('group_rank', { ascending: false }),
        supabase.from('divisions').select('*').order('name'),
        supabase.from('division_members').select('*'),
        supabase.from('division_ranks').select('*').order('hierarchy', { ascending: false }),
      ]);

      setAllUsers(usersRes.data || []);
      setDivisions(divsRes.data || []);
      setDivisionMembers(dmRes.data || []);
      setDivisionRanks(ranksRes.data || []);

      // Get activities within period
      const since = new Date();
      since.setDate(since.getDate() - period);
      const { data: acts } = await supabase
        .from('activity_log')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });
      setActivities(acts || []);

      setLoading(false);
    })();
  }, [period]);

  const signedUpUsers = useMemo(() => allUsers.filter((u) => u.onboarded), [allUsers]);

  const userActivityMap = useMemo(() => {
    const map = new Map<string, number>();
    activities.forEach((a) => {
      map.set(a.user_id, (map.get(a.user_id) || 0) + 1);
    });
    return map;
  }, [activities]);

  // Most active below HR per division
  const mostActiveBelowHR = useMemo(() => {
    const result: { division: string; users: UserActivity[] }[] = [];
    for (const div of divisions) {
      const divMemberUserIds = divisionMembers
        .filter((dm) => dm.division_id === div.id)
        .map((dm) => dm.user_id);
      const users = allUsers
        .filter((u) => divMemberUserIds.includes(u.id) && u.group_rank < 6)
        .map((u) => ({ user: u, activityCount: userActivityMap.get(u.id) || 0 }))
        .sort((a, b) => b.activityCount - a.activityCount)
        .slice(0, 5);
      result.push({ division: div.name, users });
    }
    return result;
  }, [divisions, divisionMembers, allUsers, userActivityMap]);

  // Most active HR per division
  const mostActiveHR = useMemo(() => {
    const result: { division: string; users: UserActivity[] }[] = [];
    for (const div of divisions) {
      const divMemberUserIds = divisionMembers
        .filter((dm) => dm.division_id === div.id)
        .map((dm) => dm.user_id);
      const users = allUsers
        .filter((u) => divMemberUserIds.includes(u.id) && u.group_rank >= 6)
        .map((u) => ({ user: u, activityCount: userActivityMap.get(u.id) || 0 }))
        .sort((a, b) => b.activityCount - a.activityCount)
        .slice(0, 5);
      result.push({ division: div.name, users });
    }
    return result;
  }, [divisions, divisionMembers, allUsers, userActivityMap]);

  // Path distribution
  const pathDistribution = useMemo(() => {
    const map = new Map<string, number>();
    signedUpUsers.forEach((u) => {
      if (u.selected_path) map.set(u.selected_path, (map.get(u.selected_path) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [signedUpUsers]);

  // Division stats
  const divisionStats = useMemo<DivisionStat[]>(() => {
    return divisions.map((d) => ({
      division: d,
      memberCount: divisionMembers.filter((dm) => dm.division_id === d.id).length,
      ranks: divisionRanks.filter((r) => r.division_id === d.id),
    }));
  }, [divisions, divisionMembers, divisionRanks]);

  // Roblox rank distribution
  const robloxRankDistribution = useMemo(() => {
    const map = new Map<number, number>();
    signedUpUsers.forEach((u) => {
      map.set(u.group_rank, (map.get(u.group_rank) || 0) + 1);
    });
    return ROBLOX_RANKS
      .filter((r) => map.has(r.rank))
      .sort((a, b) => b.rank - a.rank)
      .map((r) => ({ ...r, count: map.get(r.rank) || 0 }));
  }, [signedUpUsers]);

  if (!perms.can_view_hr_panel) {
    return (
      <div className="ek-panel p-12 text-center">
        <BarChart3 className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">You do not have permission to access the HR Panel.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-stone-500">Loading HR analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          HR Analytics Panel
        </h1>
        {/* Period selector */}
        <div className="flex gap-1 bg-stone-800/50 rounded-md p-1">
          {([7, 14, 30] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                period === p ? 'bg-green-700 text-white' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {p} days
            </button>
          ))}
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <OverviewCard icon={Users} label="Total Members" value={allUsers.length} color="green" />
        <OverviewCard icon={Shield} label="Signed Up" value={signedUpUsers.length} color="amber" />
        <OverviewCard icon={Activity} label="Active Events" value={activities.length} color="green" />
        <OverviewCard icon={TrendingUp} label="Divisions" value={divisions.length} color="amber" />
      </div>

      {/* Most active below HR */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title flex items-center gap-2">
          <Activity className="w-4 h-4" /> Most Active Below HR ({period} days)
        </h2>
        {mostActiveBelowHR.every((d) => d.users.length === 0) ? (
          <p className="text-stone-500 text-sm text-center py-4">No activity recorded in this period.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mostActiveBelowHR.map((d) => (
              <div key={d.division}>
                <p className="text-sm font-medium text-amber-500 mb-2">{d.division}</p>
                {d.users.length === 0 ? (
                  <p className="text-xs text-stone-600">No activity</p>
                ) : (
                  <div className="space-y-1">
                    {d.users.map((u) => (
                      <ActivityRow key={u.user.id} name={u.user.roblox_display_name || u.user.roblox_username} count={u.activityCount} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Most active HR */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title flex items-center gap-2">
          <Shield className="w-4 h-4" /> Most Active HR ({period} days)
        </h2>
        {mostActiveHR.every((d) => d.users.length === 0) ? (
          <p className="text-stone-500 text-sm text-center py-4">No HR activity recorded in this period.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mostActiveHR.map((d) => (
              <div key={d.division}>
                <p className="text-sm font-medium text-amber-500 mb-2">{d.division}</p>
                {d.users.length === 0 ? (
                  <p className="text-xs text-stone-600">No activity</p>
                ) : (
                  <div className="space-y-1">
                    {d.users.map((u) => (
                      <ActivityRow key={u.user.id} name={u.user.roblox_display_name || u.user.roblox_username} count={u.activityCount} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Path distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="ek-panel p-5">
          <h2 className="ek-section-title flex items-center gap-2">
            <Compass className="w-4 h-4" /> Path Distribution
          </h2>
          {pathDistribution.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-4">No paths selected yet.</p>
          ) : (
            <div className="space-y-2">
              {pathDistribution.map(([path, count]) => {
                const pct = (count / signedUpUsers.length) * 100;
                return (
                  <div key={path}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-stone-300">{path}</span>
                      <span className="text-stone-500">{count}</span>
                    </div>
                    <div className="h-2 bg-stone-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Roblox rank distribution */}
        <div className="ek-panel p-5">
          <h2 className="ek-section-title flex items-center gap-2">
            <Shield className="w-4 h-4" /> Roblox Rank Distribution
          </h2>
          {robloxRankDistribution.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-4">No members signed up yet.</p>
          ) : (
            <div className="space-y-1">
              {robloxRankDistribution.map((r) => (
                <div key={r.rank} className="flex items-center justify-between p-2 bg-stone-800/50 rounded-md">
                  <span className="text-sm text-stone-300">{r.name}</span>
                  <span className="text-sm font-bold text-amber-400">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Division stats */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title flex items-center gap-2">
          <Users className="w-4 h-4" /> Division Breakdown
        </h2>
        {divisionStats.length === 0 ? (
          <p className="text-stone-500 text-sm text-center py-4">No divisions created yet.</p>
        ) : (
          <div className="space-y-3">
            {divisionStats.map((ds) => (
              <div key={ds.division.id} className="p-4 bg-stone-800/50 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ds.division.icon}</span>
                    <span className="text-sm font-medium text-stone-200">{ds.division.name}</span>
                  </div>
                  <span className="text-sm text-stone-400">{ds.memberCount} members</span>
                </div>
                {ds.ranks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ds.ranks.map((r) => {
                      const count = divisionMembers.filter(
                        (dm) => dm.division_id === ds.division.id && dm.division_rank_id === r.id
                      ).length;
                      return (
                        <span key={r.id} className="ek-badge bg-stone-700/50 text-stone-300 border border-stone-600/50">
                          {r.name}: {count}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewCard({
  icon: Icon, label, value, color,
}: { icon: typeof Shield; label: string; value: number; color: 'amber' | 'green' }) {
  const colors = {
    amber: 'text-amber-400 bg-amber-900/20',
    green: 'text-green-400 bg-green-900/20',
  };
  return (
    <div className="ek-panel p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-stone-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-stone-100">{value}</p>
      </div>
    </div>
  );
}

function ActivityRow({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center justify-between p-2 bg-stone-800/50 rounded-md">
      <span className="text-sm text-stone-300 truncate">{name}</span>
      <span className="text-xs font-bold text-green-400 flex items-center gap-1">
        <Activity className="w-3 h-3" /> {count}
      </span>
    </div>
  );
}
