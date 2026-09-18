import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/lib/permissions';
import {
  Shield, Award, Swords, ChevronRight, BarChart3, Users, Clock, Compass, TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase, Division, DivisionMember, DivisionRank } from '@/lib/supabase';

export function Dashboard() {
  const { user } = useAuth();
  const perms = usePermissions();
  const [divisionInfo, setDivisionInfo] = useState<{ division: Division | null; rank: DivisionRank | null }>({
    division: null,
    rank: null,
  });
  const [militaryPoints, setMilitaryPoints] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data: pts } = await supabase.rpc('get_user_military_points', { p_user_id: user.id });
      setMilitaryPoints(pts || 0);

      const { data: member } = await supabase
        .from('division_members')
        .select('division_id, division_rank_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (member?.division_id) {
        const { data: div } = await supabase
          .from('divisions')
          .select('*')
          .eq('id', member.division_id)
          .maybeSingle();
        let rank: DivisionRank | null = null;
        if (member.division_rank_id) {
          const { data: r } = await supabase
            .from('division_ranks')
            .select('*')
            .eq('id', member.division_rank_id)
            .maybeSingle();
          rank = r;
        }
        setDivisionInfo({ division: div, rank });
      }

      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      setTotalMembers(count || 0);
    })();
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative ek-panel overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/30 to-transparent" />
        <div className="relative p-6 flex items-center gap-5">
          {user.roblox_avatar_url ? (
            <img
              src={user.roblox_avatar_url}
              alt={user.roblox_display_name || undefined}
              className="w-20 h-20 rounded-full border-2 border-amber-600/40 shadow-lg"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-stone-700 flex items-center justify-center border-2 border-amber-600/40">
              <Users className="w-10 h-10 text-stone-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
              {user.roblox_display_name || user.roblox_username}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="ek-badge bg-green-900/50 text-green-400 border border-green-700/50">
                {user.group_rank_name}
              </span>
              {divisionInfo.division && (
                <span className="ek-badge bg-amber-900/40 text-amber-400 border border-amber-700/40">
                  {divisionInfo.division.name}
                </span>
              )}
              {divisionInfo.rank && (
                <span className="ek-badge bg-stone-700/50 text-stone-300 border border-stone-600/50">
                  {divisionInfo.rank.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Award} label="Military Points" value={militaryPoints} color="amber" />
        <StatCard icon={Swords} label="Division" value={divisionInfo.division?.name || 'Unassigned'} color="green" />
        <StatCard icon={Shield} label="Division Rank" value={divisionInfo.rank?.name || 'None'} color="stone" />
        <StatCard icon={Users} label="Total Members" value={totalMembers} color="green" />
      </div>

      {/* Profile summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="ek-panel p-5">
          <h2 className="ek-section-title">Profile Details</h2>
          <div className="space-y-3">
            <DetailRow icon={Clock} label="Timezone" value={user.timezone || 'Not set'} />
            <DetailRow icon={Compass} label="Selected Path" value={user.selected_path || 'Not set'} />
            <DetailRow icon={Shield} label="Main Sub" value={user.main_sub || 'Not set'} />
            <DetailRow icon={TrendingUp} label="Group Rank" value={`${user.group_rank_name} (Rank ${user.group_rank})`} />
          </div>
          <Link to="/profile" className="ek-btn ek-btn-ghost w-full mt-4 text-sm flex items-center justify-center gap-2">
            Edit Profile <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Quick actions */}
        <div className="ek-panel p-5">
          <h2 className="ek-section-title">Quick Actions EEEEE</h2>
          <div className="space-y-2">
            <ActionLink to="/members" icon={Users} label="View Member Profiles" show />
            <ActionLink to="/divisions" icon={Swords} label="View Divisions" show />
            <ActionLink to="/promotions" icon={ChevronRight} label="Promotion Menu" show={perms.can_promote} />
            <ActionLink to="/points" icon={Award} label="Award Points" show={perms.can_award_points} />
            <ActionLink to="/hr-panel" icon={BarChart3} label="HR Analytics Panel" show={perms.can_view_hr_panel} />
            <ActionLink to="/division-ranks" icon={Shield} label="Manage Division Ranks" show={perms.can_create_ranks} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color,
}: { icon: typeof Shield; label: string; value: string | number; color: 'amber' | 'green' | 'stone' }) {
  const colors = {
    amber: 'text-amber-400 bg-amber-900/20',
    green: 'text-green-400 bg-green-900/20',
    stone: 'text-stone-300 bg-stone-700/30',
  };
  return (
    <div className="ek-panel p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-stone-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-semibold text-stone-100 truncate">{value}</p>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-stone-500 flex-shrink-0" />
      <span className="text-sm text-stone-400 w-28">{label}</span>
      <span className="text-sm text-stone-200 font-medium truncate">{value}</span>
    </div>
  );
}

function ActionLink({
  to, icon: Icon, label, show,
}: { to: string; icon: typeof Shield; label: string; show: boolean }) {
  if (!show) return null;
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-stone-800/50 hover:bg-stone-800 border border-stone-700/50 hover:border-green-700/50 transition-all group"
    >
      <Icon className="w-4 h-4 text-stone-400 group-hover:text-green-400 transition-colors" />
      <span className="text-sm text-stone-300 group-hover:text-stone-100 flex-1">{label}</span>
      <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-green-400 transition-colors" />
    </Link>
  );
}
