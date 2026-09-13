import { useEffect, useState } from 'react';
import { supabase, Division, DivisionRank, DivisionMember, DbUser } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Swords, Plus, Users, X, Save, Loader2, Trash2, UserPlus, Shield,
} from 'lucide-react';

export function Divisions() {
  const { user } = useAuth();
  const perms = usePermissions();
  const [divisions, setDivisions] = useState<(Division & { member_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);

  useEffect(() => {
    loadDivisions();
  }, []);

  const loadDivisions = async () => {
    setLoading(true);
    const { data: divs } = await supabase.from('divisions').select('*').order('name');

    const enriched: (Division & { member_count: number })[] = [];
    for (const d of divs || []) {
      const { count } = await supabase
        .from('division_members')
        .select('*', { count: 'exact', head: true })
        .eq('division_id', d.id);
      enriched.push({ ...d, member_count: count || 0 });
    }

    setDivisions(enriched);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          Divisions
        </h1>
        {perms.can_create_divisions && (
          <button onClick={() => setShowCreate(true)} className="ek-btn ek-btn-gold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Division
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-500">Loading divisions...</div>
      ) : divisions.length === 0 ? (
        <div className="ek-panel p-12 text-center">
          <Swords className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400">No divisions have been created yet.</p>
          {perms.can_create_divisions && (
            <p className="text-stone-500 text-sm mt-1">Click "Create Division" to get started.</p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {divisions.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDivision(d)}
              className="ek-panel p-5 text-left hover:border-green-700/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-md bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-2xl">
                  {d.icon || <Swords className="w-6 h-6 text-amber-400" />}
                </div>
                <div className="flex items-center gap-1 text-stone-400">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{d.member_count}</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-stone-100 group-hover:text-green-400 transition-colors">
                {d.name}
              </h3>
              {d.description && <p className="text-sm text-stone-500 mt-1 line-clamp-2">{d.description}</p>}
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDivisionModal
          userId={user!.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadDivisions(); }}
        />
      )}

      {selectedDivision && (
        <DivisionDetailModal
          division={selectedDivision}
          userId={user!.id}
          canManage={perms.can_manage_members}
          onClose={() => setSelectedDivision(null)}
          onChanged={loadDivisions}
        />
      )}
    </div>
  );
}

function CreateDivisionModal({
  userId, onClose, onCreated,
}: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Division name is required.'); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from('divisions').insert({
      name: name.trim(),
      icon: icon.trim() || null,
      description: description.trim() || null,
      created_by: userId,
    });
    if (insertError) { setError(insertError.message); setSaving(false); return; }
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="ek-panel max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-400">Create Division</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="ek-label">Division Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ek-input w-full" placeholder="e.g., Earth Guard" maxLength={50} />
          </div>
          <div>
            <label className="ek-label">Icon (emoji or symbol)</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} className="ek-input w-full" placeholder="e.g., ⚔️" maxLength={10} />
          </div>
          <div>
            <label className="ek-label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="ek-input w-full" rows={3} maxLength={200} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleCreate} disabled={saving} className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function DivisionDetailModal({
  division, userId, canManage, onClose, onChanged,
}: {
  division: Division;
  userId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [ranks, setRanks] = useState<DivisionRank[]>([]);
  const [members, setMembers] = useState<(DivisionMember & { username: string; display_name: string | null; avatar: string | null })[]>([]);
  const [allUsers, setAllUsers] = useState<DbUser[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRankId, setSelectedRankId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase
        .from('division_ranks')
        .select('*')
        .eq('division_id', division.id)
        .order('hierarchy', { ascending: false });
      setRanks(r || []);

      const { data: dm } = await supabase
        .from('division_members')
        .select('*')
        .eq('division_id', division.id);
      const memberUserIds = (dm || []).map((m) => m.user_id);
      let userMap = new Map<string, DbUser>();
      if (memberUserIds.length > 0) {
        const { data: mu } = await supabase.from('users').select('*').in('id', memberUserIds);
        (mu || []).forEach((u) => userMap.set(u.id, u));
      }
      const enriched = (dm || []).map((m) => {
        const u = userMap.get(m.user_id);
        return {
          ...m,
          username: u?.roblox_username || 'Unknown',
          display_name: u?.roblox_display_name || null,
          avatar: u?.roblox_avatar_url || null,
        };
      });
      setMembers(enriched);

      const { data: au } = await supabase.from('users').select('*').order('roblox_username');
      setAllUsers(au || []);
    })();
  }, [division.id]);

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    const { error } = await supabase.from('division_members').insert({
      user_id: selectedUserId,
      division_id: division.id,
      division_rank_id: selectedRankId || null,
    });
    if (!error) {
      setShowAddMember(false);
      setSelectedUserId('');
      setSelectedRankId('');
      // Reload modal data
      const { data: dm } = await supabase.from('division_members').select('*').eq('division_id', division.id);
      const memberUserIds = (dm || []).map((m) => m.user_id);
      let userMap = new Map<string, DbUser>();
      if (memberUserIds.length > 0) {
        const { data: mu } = await supabase.from('users').select('*').in('id', memberUserIds);
        (mu || []).forEach((u) => userMap.set(u.id, u));
      }
      setMembers((dm || []).map((m) => {
        const u = userMap.get(m.user_id);
        return { ...m, username: u?.roblox_username || 'Unknown', display_name: u?.roblox_display_name || null, avatar: u?.roblox_avatar_url || null };
      }));
      onChanged();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('division_members').delete().eq('id', memberId);
    setMembers(members.filter((m) => m.id !== memberId));
    onChanged();
  };

  const handleDeleteDivision = async () => {
    if (!confirm(`Delete division "${division.name}"? This will remove all members and ranks.`)) return;
    await supabase.from('divisions').delete().eq('id', division.id);
    onClose();
    onChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="ek-panel max-w-2xl w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-xl">
              {division.icon || <Swords className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-amber-400">{division.name}</h2>
              {division.description && <p className="text-sm text-stone-500">{division.description}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
        </div>

        {/* Ranks */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-stone-300 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-500" /> Ranks ({ranks.length})
          </h3>
          {ranks.length === 0 ? (
            <p className="text-stone-500 text-sm">No ranks defined yet.</p>
          ) : (
            <div className="space-y-1">
              {ranks.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2 bg-stone-800/50 rounded-md">
                  <div>
                    <span className="text-sm text-stone-200">{r.name}</span>
                    <span className="text-xs text-stone-500 ml-2">Hierarchy: {r.hierarchy}</span>
                  </div>
                  <div className="flex gap-1">
                    {r.can_promote && <span className="ek-badge bg-green-900/40 text-green-400 text-[10px]">Promote</span>}
                    {r.can_award_points && <span className="ek-badge bg-amber-900/40 text-amber-400 text-[10px]">Points</span>}
                    {r.can_manage_members && <span className="ek-badge bg-blue-900/40 text-blue-400 text-[10px]">Manage</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-stone-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" /> Members ({members.length})
            </h3>
            {canManage && (
              <button onClick={() => setShowAddMember(!showAddMember)} className="ek-btn ek-btn-ghost text-sm flex items-center gap-1 py-1.5 px-3">
                <UserPlus className="w-3.5 h-3.5" /> Add Member
              </button>
            )}
          </div>

          {showAddMember && (
            <div className="ek-panel-light p-3 mb-3 space-y-2">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="ek-input w-full">
                <option value="">Select user...</option>
                {allUsers
                  .filter((u) => !members.some((m) => m.user_id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.roblox_display_name || u.roblox_username}</option>
                  ))}
              </select>
              <select value={selectedRankId} onChange={(e) => setSelectedRankId(e.target.value)} className="ek-input w-full">
                <option value="">No rank (unranked)</option>
                {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={handleAddMember} className="ek-btn ek-btn-primary w-full text-sm">Add</button>
            </div>
          )}

          {members.length === 0 ? (
            <p className="text-stone-500 text-sm">No members in this division.</p>
          ) : (
            <div className="space-y-1">
              {members.map((m) => {
                const rank = ranks.find((r) => r.id === m.division_rank_id);
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2 bg-stone-800/50 rounded-md">
                    {m.avatar ? (
                      <img src={m.avatar} alt={m.display_name || m.username} className="w-8 h-8 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center"><Users className="w-4 h-4 text-stone-400" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-200 truncate">{m.display_name || m.username}</p>
                      {rank && <p className="text-xs text-amber-500">{rank.name}</p>}
                    </div>
                    {canManage && (
                      <button onClick={() => handleRemoveMember(m.id)} className="text-stone-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canManage && (
          <button onClick={handleDeleteDivision} className="ek-btn ek-btn-danger w-full text-sm flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> Delete Division
          </button>
        )}
      </div>
    </div>
  );
}
