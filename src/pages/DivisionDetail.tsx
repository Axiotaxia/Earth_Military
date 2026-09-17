import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, Division, DivisionRank, DivisionMember, DbUser, ActivityLog } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Swords, Shield, Users, ArrowLeft, Settings, Plus, X, Save, Loader2, Trash2,
  ArrowUp, Check, Activity, BarChart3, Crown, ChevronRight, Upload,
} from 'lucide-react';

type Tab = 'overview' | 'ranks' | 'members' | 'promotions' | 'activity';

interface DivisionMemberWithUser extends DivisionMember {
  user: DbUser;
  rank: DivisionRank | null;
}

export function DivisionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const perms = usePermissions();
  const { user } = useAuth();
  const [division, setDivision] = useState<Division | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [ranks, setRanks] = useState<DivisionRank[]>([]);
  const [members, setMembers] = useState<DivisionMemberWithUser[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [showCreateRank, setShowCreateRank] = useState(false);
  const [editingRank, setEditingRank] = useState<DivisionRank | null>(null);
  const [promotingMember, setPromotingMember] = useState<DivisionMemberWithUser | null>(null);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    const { data: div } = await supabase.from('divisions').select('*').eq('id', id).maybeSingle();
    if (!div) { navigate('/divisions'); return; }
    setDivision(div);

    const { data: r } = await supabase
      .from('division_ranks')
      .select('*')
      .eq('division_id', id!)
      .order('hierarchy', { ascending: false });
    setRanks(r || []);

    const { data: dm } = await supabase
      .from('division_members')
      .select('*')
      .eq('division_id', id!);
    const memberUserIds = (dm || []).map((m) => m.user_id);
    let userMap = new Map<string, DbUser>();
    if (memberUserIds.length > 0) {
      const { data: mu } = await supabase.from('users').select('*').in('id', memberUserIds);
      (mu || []).forEach((u) => userMap.set(u.id, u));
    }
    const rankMap = new Map<string, DivisionRank>();
    (r || []).forEach((rk) => rankMap.set(rk.id, rk));
    setMembers(
      (dm || []).map((m) => ({
        ...m,
        user: userMap.get(m.user_id)!,
        rank: m.division_rank_id ? rankMap.get(m.division_rank_id) || null : null,
      })).filter((m) => m.user)
    );

    const memberIds = memberUserIds;
    if (memberIds.length > 0) {
      const { data: acts } = await supabase
        .from('activity_log')
        .select('*')
        .in('user_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(50);
      setActivities(acts || []);
    }

    setLoading(false);
  };

  if (loading) return <div className="text-center py-12 text-stone-500">Loading division...</div>;
  if (!division) return null;

  const canManage = perms.is_owner || perms.can_manage_members;
  const canCreateRanks = perms.is_owner || perms.can_create_ranks;
  const canPromote = perms.is_owner || perms.can_promote;

  const tabs: { id: Tab; label: string; icon: typeof Shield; show: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3, show: true },
    { id: 'ranks', label: 'Ranks', icon: Shield, show: true },
    { id: 'members', label: 'Members', icon: Users, show: true },
    { id: 'promotions', label: 'Promotions', icon: ArrowUp, show: canPromote },
    { id: 'activity', label: 'Activity', icon: Activity, show: true },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/divisions" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-amber-400 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Divisions
      </Link>

      {/* Division header */}
      <div className="ek-panel overflow-hidden">
        <div className="bg-gradient-to-r from-green-900/30 to-transparent p-6 flex items-center gap-5">
          <DivisionLogo division={division} size="lg" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
              {division.name}
            </h1>
            {division.description && <p className="text-stone-400 text-sm mt-1">{division.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <span className="ek-badge bg-stone-700/50 text-stone-300 border border-stone-600/50">
                {members.length} members
              </span>
              <span className="ek-badge bg-stone-700/50 text-stone-300 border border-stone-600/50">
                {ranks.length} ranks
              </span>
            </div>
          </div>
          {canManage && (
            <UploadLogoButton divisionId={division.id} onUploaded={loadAll} />
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-t border-stone-800 overflow-x-auto">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab division={division} ranks={ranks} members={members} activities={activities} />}
      {tab === 'ranks' && (
        <RanksTab
          division={division}
          ranks={ranks}
          canCreateRanks={canCreateRanks}
          showCreateRank={showCreateRank}
          setShowCreateRank={setShowCreateRank}
          editingRank={editingRank}
          setEditingRank={setEditingRank}
          onChanged={loadAll}
        />
      )}
      {tab === 'members' && <MembersTab members={members} ranks={ranks} canManage={canManage} onChanged={loadAll} />}
      {tab === 'promotions' && (
        <PromotionsTab
          members={members}
          ranks={ranks}
          currentUser={user}
          canPromote={canPromote}
          promotingMember={promotingMember}
          setPromotingMember={setPromotingMember}
          onChanged={loadAll}
        />
      )}
      {tab === 'activity' && <ActivityTab activities={activities} />}
    </div>
  );
}

function DivisionLogo({ division, size }: { division: Division; size: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-10 h-10', md: 'w-12 h-12', lg: 'w-20 h-20' };
  const iconSizes = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-10 h-10' };

  if (division.logo_url) {
    return (
      <img
        src={division.logo_url}
        alt={division.name}
        className={`${sizes[size]} rounded-md object-cover border-2 border-amber-600/40`}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${sizes[size]} rounded-md bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-2xl border-2 border-amber-600/20`}>
      {division.icon || <Swords className={`${iconSizes[size]} text-amber-400`} />}
    </div>
  );
}

function UploadLogoButton({ divisionId, onUploaded }: { divisionId: string; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useState<HTMLInputElement | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const fileName = `${divisionId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('division-logos')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      const { data: urlData } = supabase.storage.from('division-logos').getPublicUrl(fileName);
      await supabase.from('divisions').update({ logo_url: urlData.publicUrl }).eq('id', divisionId);
    } else {
      const { data: urlData } = supabase.storage.from('division-logos').getPublicUrl(fileName);
      await supabase.from('divisions').update({ logo_url: urlData.publicUrl }).eq('id', divisionId);
    }

    setUploading(false);
    onUploaded();
  };

  return (
    <div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        onChange={handleUpload}
        className="hidden"
        ref={(el) => { fileRef[1](el); }}
      />
      <button
        onClick={() => fileRef[0]?.click()}
        disabled={uploading}
        className="ek-btn ek-btn-ghost text-sm flex items-center gap-1.5"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        Upload Logo
      </button>
    </div>
  );
}

function OverviewTab({
  division, ranks, members, activities,
}: {
  division: Division;
  ranks: DivisionRank[];
  members: DivisionMemberWithUser[];
  activities: ActivityLog[];
}) {
  const totalPoints = members.reduce(async (accPromise, m) => {
    const acc = await accPromise;
    const { data: pts } = await supabase.rpc('get_user_military_points', { p_user_id: m.user_id });
    return acc + (pts || 0);
  }, Promise.resolve(0));

  const [pointsSum, setPointsSum] = useState(0);
  useEffect(() => {
    (async () => {
      let sum = 0;
      for (const m of members) {
        const { data: pts } = await supabase.rpc('get_user_military_points', { p_user_id: m.user_id });
        sum += pts || 0;
      }
      setPointsSum(sum);
    })();
  }, [members]);

  const last7 = activities.filter((a) => {
    const d = new Date(a.created_at);
    return d > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Members" value={members.length} color="green" />
        <StatCard icon={Shield} label="Ranks" value={ranks.length} color="amber" />
        <StatCard icon={Activity} label="Activity (7d)" value={last7} color="green" />
        <StatCard icon={BarChart3} label="Total Points" value={pointsSum} color="amber" />
      </div>

      {/* Hierarchy display */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title">Rank Hierarchy</h2>
        {ranks.length === 0 ? (
          <p className="text-stone-500 text-sm">No ranks defined yet.</p>
        ) : (
          <div className="space-y-1">
            {ranks.map((r) => {
              const count = members.filter((m) => m.division_rank_id === r.id).length;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 bg-stone-800/50 rounded-md">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 w-8">H{r.hierarchy}</span>
                    <span className="text-sm text-stone-200">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">{count} members</span>
                    <div className="flex gap-1">
                      {r.can_promote && <span className="ek-badge bg-green-900/40 text-green-400 text-[10px]">Promote</span>}
                      {r.can_award_points && <span className="ek-badge bg-amber-900/40 text-amber-400 text-[10px]">Points</span>}
                      {r.can_manage_members && <span className="ek-badge bg-blue-900/40 text-blue-400 text-[10px]">Manage</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title">Recent Activity</h2>
        {activities.length === 0 ? (
          <p className="text-stone-500 text-sm text-center py-4">No recent activity.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {activities.slice(0, 20).map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 bg-stone-800/50 rounded-md">
                <div>
                  <p className="text-sm text-stone-200">{a.event_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-stone-500">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Shield; label: string; value: number; color: 'amber' | 'green' }) {
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

function RanksTab({
  division, ranks, canCreateRanks, showCreateRank, setShowCreateRank, editingRank, setEditingRank, onChanged,
}: {
  division: Division;
  ranks: DivisionRank[];
  canCreateRanks: boolean;
  showCreateRank: boolean;
  setShowCreateRank: (v: boolean) => void;
  editingRank: DivisionRank | null;
  setEditingRank: (v: DivisionRank | null) => void;
  onChanged: () => void;
}) {
  const handleDelete = async (rankId: string) => {
    if (!confirm('Delete this rank?')) return;
    await supabase.from('division_ranks').delete().eq('id', rankId);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-200">Division Ranks</h2>
        {canCreateRanks && (
          <button onClick={() => setShowCreateRank(true)} className="ek-btn ek-btn-gold flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Create Rank
          </button>
        )}
      </div>

      {ranks.length === 0 ? (
        <div className="ek-panel p-12 text-center">
          <Shield className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400">No ranks created for this division yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranks.map((r) => (
            <div key={r.id} className="ek-panel p-4 flex items-center gap-4">
              <div className="flex flex-col items-center">
                <span className="text-xs text-stone-500">H</span>
                <span className="text-lg font-bold text-amber-400">{r.hierarchy}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-100">{r.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.can_create_divisions && <PermBadge label="Create Div" />}
                  {r.can_create_ranks && <PermBadge label="Create Ranks" />}
                  {r.can_promote && <PermBadge label="Promote" />}
                  {r.can_award_points && <PermBadge label="Award Points" />}
                  {r.can_view_hr_panel && <PermBadge label="HR Panel" />}
                  {r.can_manage_members && <PermBadge label="Manage Members" />}
                </div>
              </div>
              {canCreateRanks && (
                <div className="flex gap-1">
                  <button onClick={() => setEditingRank(r)} className="text-stone-400 hover:text-amber-400 p-1">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="text-stone-400 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateRank && (
        <RankModal division={division} onClose={() => setShowCreateRank(false)} onSaved={() => { setShowCreateRank(false); onChanged(); }} />
      )}
      {editingRank && (
        <RankModal division={division} rank={editingRank} onClose={() => setEditingRank(null)} onSaved={() => { setEditingRank(null); onChanged(); }} />
      )}
    </div>
  );
}

function PermBadge({ label }: { label: string }) {
  return <span className="ek-badge bg-green-900/30 text-green-400 border border-green-800/30 text-[10px]">{label}</span>;
}

function RankModal({
  division, rank, onClose, onSaved,
}: {
  division: Division;
  rank?: DivisionRank;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rank?.name || '');
  const [hierarchy, setHierarchy] = useState(rank?.hierarchy || 0);
  const [perms, setPerms] = useState({
    can_create_divisions: rank?.can_create_divisions || false,
    can_create_ranks: rank?.can_create_ranks || false,
    can_promote: rank?.can_promote || false,
    can_award_points: rank?.can_award_points || false,
    can_view_hr_panel: rank?.can_view_hr_panel || false,
    can_manage_members: rank?.can_manage_members || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('Rank name is required.'); return; }
    setSaving(true);
    if (rank) {
      const { error: e } = await supabase
        .from('division_ranks')
        .update({ name: name.trim(), hierarchy, ...perms })
        .eq('id', rank.id);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('division_ranks').insert({
        division_id: division.id,
        name: name.trim(),
        hierarchy,
        ...perms,
      });
      if (e) { setError(e.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  };

  const permFields: { key: keyof typeof perms; label: string }[] = [
    { key: 'can_create_divisions', label: 'Can create divisions' },
    { key: 'can_create_ranks', label: 'Can create ranks' },
    { key: 'can_promote', label: 'Can promote members' },
    { key: 'can_award_points', label: 'Can award points' },
    { key: 'can_view_hr_panel', label: 'Can view HR panel' },
    { key: 'can_manage_members', label: 'Can manage members' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="ek-panel max-w-md w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-400">{rank ? 'Edit Rank' : 'Create Rank'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="ek-label">Rank Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ek-input w-full" placeholder="e.g., Division Commander" maxLength={50} />
          </div>
          <div>
            <label className="ek-label">Hierarchy (higher = more authority)</label>
            <input type="number" value={hierarchy} onChange={(e) => setHierarchy(parseInt(e.target.value) || 0)} className="ek-input w-full" />
          </div>
          <div>
            <label className="ek-label">Permissions</label>
            <div className="space-y-2">
              {permFields.map((p) => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={perms[p.key]} onChange={(e) => setPerms({ ...perms, [p.key]: e.target.checked })} className="w-4 h-4 rounded accent-green-600" />
                  <span className="text-sm text-stone-300">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleSave} disabled={saving} className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {rank ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MembersTab({
  members, ranks, canManage, onChanged,
}: {
  members: DivisionMemberWithUser[];
  ranks: DivisionRank[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this member from the division?')) return;
    await supabase.from('division_members').delete().eq('id', memberId);
    onChanged();
  };

  const handleChangeRank = async (member: DivisionMemberWithUser, newRankId: string) => {
    await supabase.from('division_members').update({ division_rank_id: newRankId || null }).eq('id', member.id);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-200">Members ({members.length})</h2>
        <p className="text-sm text-stone-500">Assign members from their profile page</p>
      </div>

      {members.length === 0 ? (
        <div className="ek-panel p-12 text-center">
          <Users className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400">No members in this division yet.</p>
          <p className="text-stone-500 text-sm mt-1">Assign members by opening their profile from the Member Profiles page.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="ek-panel p-4 flex items-center gap-4">
              {m.user.roblox_avatar_url ? (
                <img src={m.user.roblox_avatar_url} alt={m.user.roblox_display_name || undefined} className="w-10 h-10 rounded-full border border-stone-600" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center"><Users className="w-5 h-5 text-stone-400" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-100 truncate">{m.user.roblox_display_name || m.user.roblox_username}</p>
                <p className="text-xs text-stone-500">{m.user.group_rank_name}</p>
              </div>
              {canManage ? (
                <select
                  value={m.division_rank_id || ''}
                  onChange={(e) => handleChangeRank(m, e.target.value)}
                  className="ek-input text-sm w-40"
                >
                  <option value="">No rank</option>
                  {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : (
                m.rank && <span className="ek-badge bg-amber-900/40 text-amber-400 border border-amber-700/40">{m.rank.name}</span>
              )}
              {canManage && (
                <button onClick={() => handleRemove(m.id)} className="text-stone-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PromotionsTab({
  members, ranks, currentUser, canPromote, promotingMember, setPromotingMember, onChanged,
}: {
  members: DivisionMemberWithUser[];
  ranks: DivisionRank[];
  currentUser: DbUser | null;
  canPromote: boolean;
  promotingMember: DivisionMemberWithUser | null;
  setPromotingMember: (v: DivisionMemberWithUser | null) => void;
  onChanged: () => void;
}) {
  const [newRankId, setNewRankId] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const canPromoteMember = (m: DivisionMemberWithUser) => {
    if (!currentUser) return false;
    if (currentUser.roblox_user_id === 593587739) return true;
    return m.user.group_rank < currentUser.group_rank;
  };

  const handlePromote = async () => {
    if (!promotingMember || !newRankId) return;
    setSaving(true);
    const { error } = await supabase
      .from('division_members')
      .update({ division_rank_id: newRankId })
      .eq('id', promotingMember.id);
    if (!error) {
      await supabase.from('activity_log').insert({
        user_id: promotingMember.user_id,
        event_type: 'promotion',
        event_data: { new_rank_id: newRankId, promoted_by: currentUser!.id },
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setPromotingMember(null);
        setNewRankId('');
        onChanged();
      }, 1500);
    }
    setSaving(false);
  };

  if (!canPromote) {
    return (
      <div className="ek-panel p-12 text-center">
        <Shield className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">You do not have promotion permission.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-400">You can only promote members with lower group rank. Division ranks only.</p>

      {members.length === 0 ? (
        <div className="ek-panel p-12 text-center">
          <Users className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400">No members in this division.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
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
                  onClick={() => { setPromotingMember(m); setNewRankId(m.rank?.id || ''); }}
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

      {promotingMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setPromotingMember(null)}>
          <div className="ek-panel max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-amber-400">Promote {promotingMember.user.roblox_display_name || promotingMember.user.roblox_username}</h2>
              <button onClick={() => setPromotingMember(null)} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-stone-400 mb-4">
              Current rank: <span className="text-stone-200">{promotingMember.rank?.name || 'Unranked'}</span>
            </p>
            <label className="ek-label">New Division Rank</label>
            <select value={newRankId} onChange={(e) => setNewRankId(e.target.value)} className="ek-input w-full">
              <option value="">Select new rank...</option>
              {ranks.map((r) => <option key={r.id} value={r.id}>{r.name} (H{r.hierarchy})</option>)}
            </select>
            <button onClick={handlePromote} disabled={saving || !newRankId} className="ek-btn ek-btn-primary w-full mt-4 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : success ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {success ? 'Promoted!' : 'Confirm Promotion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ activities }: { activities: ActivityLog[] }) {
  if (activities.length === 0) {
    return (
      <div className="ek-panel p-12 text-center">
        <Activity className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">No activity recorded for this division.</p>
      </div>
    );
  }

  return (
    <div className="ek-panel p-5">
      <h2 className="ek-section-title">Activity Log</h2>
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {activities.map((a) => (
          <div key={a.id} className="flex items-center justify-between p-3 bg-stone-800/50 rounded-md">
            <div>
              <p className="text-sm text-stone-200 capitalize">{a.event_type.replace(/_/g, ' ')}</p>
              {a.event_data && (
                <p className="text-xs text-stone-500">
                  {Object.entries(a.event_data).slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(', ')}
                </p>
              )}
            </div>
            <span className="text-xs text-stone-500">{new Date(a.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
