import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  supabase, Division, DivisionRank, DivisionMember, DbUser, ActivityLog,
} from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Swords, Users, Shield, ArrowLeft, Settings, Trash2, Save, Loader2, X,
  Image as ImageIcon, Activity, Award, UserMinus,
} from 'lucide-react';

interface EnrichedMember extends DivisionMember {
  user: DbUser | null;
  rank: DivisionRank | null;
}

interface EnrichedActivity extends ActivityLog {
  user: DbUser | null;
}

export function DivisionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const perms = usePermissions();
  const { user } = useAuth();

  const [division, setDivision] = useState<Division | null>(null);
  const [ranks, setRanks] = useState<DivisionRank[]>([]);
  const [members, setMembers] = useState<EnrichedMember[]>([]);
  const [activity, setActivity] = useState<EnrichedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [tab, setTab] = useState<'hierarchy' | 'members' | 'activity'>('hierarchy');

  useEffect(() => {
    if (id) loadAll(id);
  }, [id]);

  const loadAll = async (divisionId: string) => {
    setLoading(true);

    const { data: div } = await supabase.from('divisions').select('*').eq('id', divisionId).maybeSingle();
    setDivision(div);

    const { data: r } = await supabase
      .from('division_ranks')
      .select('*')
      .eq('division_id', divisionId)
      .order('hierarchy', { ascending: false });
    setRanks(r || []);

    const { data: dm } = await supabase
      .from('division_members')
      .select('*')
      .eq('division_id', divisionId);

    const memberUserIds = (dm || []).map((m) => m.user_id);
    const userMap = new Map<string, DbUser>();
    if (memberUserIds.length > 0) {
      const { data: mu } = await supabase.from('users').select('*').in('id', memberUserIds);
      (mu || []).forEach((u) => userMap.set(u.id, u));
    }
    const rankMap = new Map<string, DivisionRank>((r || []).map((rk) => [rk.id, rk]));

    const enrichedMembers: EnrichedMember[] = (dm || []).map((m) => ({
      ...m,
      user: userMap.get(m.user_id) || null,
      rank: m.division_rank_id ? rankMap.get(m.division_rank_id) || null : null,
    }));
    setMembers(enrichedMembers);

    if (memberUserIds.length > 0) {
      const { data: acts } = await supabase
        .from('activity_log')
        .select('*')
        .in('user_id', memberUserIds)
        .order('created_at', { ascending: false })
        .limit(30);
      setActivity((acts || []).map((a) => ({ ...a, user: userMap.get(a.user_id) || null })));
    } else {
      setActivity([]);
    }

    setLoading(false);
  };

  const canManageMember = (m: EnrichedMember): boolean => {
    if (!perms.can_manage_members) return false;
    if (perms.is_owner) return true;
    if (!user || !m.user) return false;
    return m.user.group_rank < user.group_rank;
  };

  const handleRemoveMember = async (member: EnrichedMember) => {
    if (!canManageMember(member)) return;
    if (!confirm('Remove this member from the division?')) return;
    await supabase.from('division_members').delete().eq('id', member.id);
    if (id) loadAll(id);
  };

  const handleDeleteDivision = async () => {
    if (!division) return;
    if (!confirm(`Delete division "${division.name}"? This will remove all members and ranks.`)) return;
    await supabase.from('divisions').delete().eq('id', division.id);
    navigate('/divisions');
  };

  if (loading) {
    return <div className="text-center py-12 text-stone-500">Loading division...</div>;
  }

  if (!division) {
    return (
      <div className="ek-panel p-12 text-center">
        <Swords className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">Division not found.</p>
        <Link to="/divisions" className="ek-btn ek-btn-ghost mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Divisions
        </Link>
      </div>
    );
  }

  // Group members by rank hierarchy (descending), unranked at bottom
  const membersByRank = new Map<string, EnrichedMember[]>();
  const unranked: EnrichedMember[] = [];
  members.forEach((m) => {
    if (m.rank) {
      const list = membersByRank.get(m.rank.id) || [];
      list.push(m);
      membersByRank.set(m.rank.id, list);
    } else {
      unranked.push(m);
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/divisions')} className="text-stone-400 hover:text-stone-200">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-md bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
          {division.logo_url ? (
            <img
              src={division.logo_url}
              alt={division.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            division.icon || <Swords className="w-7 h-7 text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-amber-400 truncate" style={{ fontFamily: 'Cinzel, serif' }}>
            {division.name}
          </h1>
          {division.description && <p className="text-sm text-stone-500 truncate">{division.description}</p>}
        </div>
        {perms.can_manage_members && (
          <button onClick={() => setShowEdit(true)} className="ek-btn ek-btn-ghost text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" /> Edit
          </button>
        )}
        {perms.can_create_ranks && (
          <button onClick={() => navigate('/division-ranks')} className="ek-btn ek-btn-ghost text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" /> Ranks
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-800">
        <TabButton active={tab === 'hierarchy'} onClick={() => setTab('hierarchy')} icon={Shield} label="Hierarchy" />
        <TabButton active={tab === 'members'} onClick={() => setTab('members')} icon={Users} label={`Members (${members.length})`} />
        <TabButton active={tab === 'activity'} onClick={() => setTab('activity')} icon={Activity} label="Activity" />
      </div>

      {tab === 'hierarchy' && (
        <div className="space-y-4">
          {ranks.length === 0 ? (
            <div className="ek-panel p-12 text-center">
              <Shield className="w-12 h-12 text-stone-600 mx-auto mb-3" />
              <p className="text-stone-400">No ranks defined for this division yet.</p>
              {perms.can_create_ranks && (
                <button onClick={() => navigate('/division-ranks')} className="ek-btn ek-btn-gold mt-4 text-sm">
                  Create Ranks
                </button>
              )}
            </div>
          ) : (
            ranks.map((r) => {
              const rankMembers = membersByRank.get(r.id) || [];
              return (
                <div key={r.id} className="ek-panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-500" />
                      <h3 className="text-sm font-semibold text-stone-100">{r.name}</h3>
                      <span className="text-xs text-stone-500">Hierarchy {r.hierarchy}</span>
                    </div>
                    <span className="text-xs text-stone-500">{rankMembers.length} member{rankMembers.length !== 1 ? 's' : ''}</span>
                  </div>
                  {rankMembers.length === 0 ? (
                    <p className="text-stone-600 text-sm">No members hold this rank.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {rankMembers.map((m) => (
                        <MemberChip key={m.id} member={m} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {unranked.length > 0 && (
            <div className="ek-panel p-4">
              <h3 className="text-sm font-semibold text-stone-400 mb-3">Unranked</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {unranked.map((m) => <MemberChip key={m.id} member={m} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="ek-panel p-4">
          <p className="text-xs text-stone-500 mb-3">
            To add a member to this division, go to their member profile and assign them there.
          </p>
          {members.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-6">No members in this division.</p>
          ) : (
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2 bg-stone-800/50 rounded-md">
                  {m.user?.roblox_avatar_url ? (
                    <img src={m.user.roblox_avatar_url} alt="" className="w-8 h-8 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center"><Users className="w-4 h-4 text-stone-400" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-200 truncate">{m.user?.roblox_display_name || m.user?.roblox_username || 'Unknown'}</p>
                    {m.rank && <p className="text-xs text-amber-500">{m.rank.name}</p>}
                  </div>
                  {canManageMember(m) && (
                    <button onClick={() => handleRemoveMember(m)} className="text-stone-500 hover:text-red-400 p-1">
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="ek-panel p-4">
          {activity.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-6">No recent activity for this division's members.</p>
          ) : (
            <div className="space-y-1">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2 bg-stone-800/50 rounded-md">
                  <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-200 truncate">
                      {a.user?.roblox_display_name || a.user?.roblox_username || 'Unknown'}
                      <span className="text-stone-500"> &middot; {formatEvent(a)}</span>
                    </p>
                  </div>
                  <span className="text-xs text-stone-500 flex-shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {perms.can_manage_members && tab === 'members' && (
        <button onClick={handleDeleteDivision} className="ek-btn ek-btn-danger w-full text-sm flex items-center justify-center gap-2">
          <Trash2 className="w-4 h-4" /> Delete Division
        </button>
      )}

      {showEdit && (
        <EditDivisionModal
          division={division}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); if (id) loadAll(id); }}
        />
      )}
    </div>
  );
}

function formatEvent(a: EnrichedActivity): string {
  if (a.event_type === 'points_awarded' && a.event_data) {
    const points = a.event_data.points as number | undefined;
    const reason = a.event_data.reason as string | undefined;
    if (typeof points === 'number' && reason) {
      return `${points >= 0 ? '+' : ''}${points} for ${reason}`;
    }
  }
  return a.event_type.replace(/_/g, ' ');
}

function MemberChip({ member }: { member: EnrichedMember }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-stone-800/50 rounded-md">
      {member.user?.roblox_avatar_url ? (
        <img src={member.user.roblox_avatar_url} alt="" className="w-7 h-7 rounded-full flex-shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 text-stone-400" /></div>
      )}
      <span className="text-sm text-stone-200 truncate">{member.user?.roblox_display_name || member.user?.roblox_username || 'Unknown'}</span>
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Shield; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-green-500 text-green-400' : 'border-transparent text-stone-500 hover:text-stone-300'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function EditDivisionModal({
  division, onClose, onSaved,
}: { division: Division; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(division.name);
  const [icon, setIcon] = useState(division.icon || '');
  const [logoUrl, setLogoUrl] = useState(division.logo_url || '');
  const [description, setDescription] = useState(division.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('Division name is required.'); return; }
    setSaving(true);
    const { error: e } = await supabase
      .from('divisions')
      .update({
        name: name.trim(),
        icon: icon.trim() || null,
        logo_url: logoUrl.trim() || null,
        description: description.trim() || null,
      })
      .eq('id', division.id);
    if (e) { setError(e.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="ek-panel max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-400">Edit Division</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="ek-label">Division Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ek-input w-full" maxLength={50} />
          </div>
          <div>
            <label className="ek-label">Icon (emoji or symbol, fallback)</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} className="ek-input w-full" maxLength={10} />
          </div>
          <div>
            <label className="ek-label flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Logo Image URL (PNG)
            </label>
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="ek-input w-full" placeholder="https://example.com/logo.png" />
            {logoUrl.trim() && (
              <img
                src={logoUrl.trim()}
                alt="Logo preview"
                className="w-14 h-14 rounded-md object-cover mt-2 border border-stone-700"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
          </div>
          <div>
            <label className="ek-label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="ek-input w-full" rows={3} maxLength={200} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleSave} disabled={saving} className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
