import { useEffect, useState } from 'react';
import { supabase, DbUser, PointEventType } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Award, Search, X, Loader2, Check, Users, Plus, Trash2, Send, Settings, Save, ArrowLeft,
} from 'lucide-react';

interface MassPointEntry {
  userId: string;
  username: string;
  display_name: string | null;
}

export function Points() {
  const perms = usePermissions();
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<DbUser[]>([]);
  const [eventTypes, setEventTypes] = useState<PointEventType[]>([]);
  const [search, setSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState<PointEventType | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [customPoints, setCustomPoints] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<MassPointEntry[]>([]);
  const [awarding, setAwarding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recentAwards, setRecentAwards] = useState<{ user_id: string; points: number; reason: string; created_at: string }[]>([]);
  const [showManageTypes, setShowManageTypes] = useState(false);

  const loadEventTypes = async () => {
    const { data } = await supabase.from('point_event_types').select('*').order('sort_order');
    setEventTypes(data || []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .gte('group_rank', 2)
        .order('roblox_username');
      setAllUsers(data || []);

      const { data: recent } = await supabase
        .from('point_transactions')
        .select('user_id, points, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentAwards(recent || []);

      await loadEventTypes();
    })();
  }, []);

  if (!perms.can_award_points) {
    return (
      <div className="ek-panel p-12 text-center">
        <Award className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">You do not have permission to award military points.</p>
      </div>
    );
  }

  if (showManageTypes) {
    return (
      <ManagePointTypes
        eventTypes={eventTypes}
        userId={user!.id}
        onBack={() => setShowManageTypes(false)}
        onChanged={loadEventTypes}
      />
    );
  }

  const filteredUsers = allUsers.filter((u) => {
    const q = search.toLowerCase();
    return u.roblox_username.toLowerCase().includes(q) || (u.roblox_display_name || '').toLowerCase().includes(q);
  });

  const toggleUser = (u: DbUser) => {
    const entry: MassPointEntry = { userId: u.id, username: u.roblox_username, display_name: u.roblox_display_name };
    if (selectedUsers.some((s) => s.userId === u.id)) {
      setSelectedUsers(selectedUsers.filter((s) => s.userId !== u.id));
    } else {
      setSelectedUsers([...selectedUsers, entry]);
    }
  };

  const handleAward = async () => {
    const reason = selectedReason?.reason || customReason;
    const points = selectedReason?.points || customPoints;
    const eventType = selectedReason?.event_type || 'custom';

    if (!reason.trim() || points === 0 || selectedUsers.length === 0) return;

    setAwarding(true);

    const inserts = selectedUsers.map((s) => ({
      user_id: s.userId,
      awarded_by: user!.id,
      points,
      reason: reason.trim(),
      event_type: eventType,
    }));

    const { error } = await supabase.from('point_transactions').insert(inserts);

    if (!error) {
      // Log activity for each user
      const activities = selectedUsers.map((s) => ({
        user_id: s.userId,
        event_type: 'points_awarded',
        event_data: { points, reason: reason.trim(), awarded_by: user!.id },
      }));
      await supabase.from('activity_log').insert(activities);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedUsers([]);
        setCustomReason('');
        setCustomPoints(0);
        setSelectedReason(null);
      }, 2000);
    }
    setAwarding(false);
  };

  const effectivePoints = selectedReason?.points || customPoints;
  const effectiveReason = selectedReason?.reason || customReason;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          Military Points
        </h1>
        {perms.can_edit_point_types && (
          <button onClick={() => setShowManageTypes(true)} className="ek-btn ek-btn-ghost text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" /> Manage Event Types
          </button>
        )}
      </div>

      {/* Point reason selection */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title">1. Select Event Type</h2>
        {eventTypes.length === 0 ? (
          <p className="text-stone-500 text-sm">No event types configured yet. Use a custom event below.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {eventTypes.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedReason(r); setCustomReason(''); setCustomPoints(0); }}
                className={`p-3 rounded-md text-left border transition-all ${
                  selectedReason?.id === r.id
                    ? 'bg-green-800/30 border-green-500 text-green-300'
                    : 'bg-stone-800/50 border-stone-700 text-stone-400 hover:border-stone-600'
                }`}
              >
                <p className="text-sm font-medium">{r.reason}</p>
                <p className={`text-lg font-bold mt-1 ${r.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.points >= 0 ? '+' : ''}{r.points}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Custom reason */}
        <div className="mt-4 pt-4 border-t border-stone-700">
          <p className="text-sm text-stone-400 mb-2">Or create a custom event:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={customReason}
              onChange={(e) => { setCustomReason(e.target.value); setSelectedReason(null); }}
              placeholder="Custom reason..."
              className="ek-input"
            />
            <input
              type="number"
              value={customPoints || ''}
              onChange={(e) => { setCustomPoints(parseInt(e.target.value) || 0); setSelectedReason(null); }}
              placeholder="Points (use negative for deductions)"
              className="ek-input"
            />
          </div>
        </div>
      </div>

      {/* User selection */}
      <div className="ek-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="ek-section-title mb-0">2. Select Members ({selectedUsers.length} selected)</h2>
          {selectedUsers.length > 0 && (
            <button onClick={() => setSelectedUsers([])} className="text-sm text-stone-400 hover:text-red-400 flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members by name..."
            className="ek-input pl-9 w-full"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {filteredUsers.map((u) => {
            const isSelected = selectedUsers.some((s) => s.userId === u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggleUser(u)}
                className={`w-full flex items-center gap-3 p-2 rounded-md border transition-all ${
                  isSelected
                    ? 'bg-green-800/30 border-green-600'
                    : 'bg-stone-800/30 border-stone-700/50 hover:border-stone-600'
                }`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                  isSelected ? 'bg-green-600 border-green-500' : 'border-stone-600'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                {u.roblox_avatar_url ? (
                  <img src={u.roblox_avatar_url} alt="" className="w-7 h-7 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-stone-400" /></div>
                )}
                <span className="text-sm text-stone-200 flex-1 text-left">{u.roblox_display_name || u.roblox_username}</span>
                <span className="text-xs text-stone-500">{u.group_rank_name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Award summary and button */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title">3. Review & Award</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <p className="text-sm text-stone-400">Reason</p>
            <p className="text-stone-100 font-medium">{effectiveReason || 'Not set'}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-stone-400">Per member</p>
            <p className={`text-2xl font-bold ${effectivePoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {effectivePoints >= 0 ? '+' : ''}{effectivePoints || 0}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-stone-400">Total</p>
            <p className={`text-2xl font-bold text-amber-400`}>
              {((effectivePoints || 0) * selectedUsers.length) >= 0 ? '+' : ''}{(effectivePoints || 0) * selectedUsers.length}
            </p>
          </div>
        </div>
        <button
          onClick={handleAward}
          disabled={awarding || !effectiveReason || !effectivePoints || selectedUsers.length === 0}
          className="ek-btn ek-btn-gold w-full flex items-center justify-center gap-2 text-base py-3"
        >
          {awarding ? <Loader2 className="w-5 h-5 animate-spin" /> : success ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          {success ? 'Points Awarded!' : `Award Points to ${selectedUsers.length} member${selectedUsers.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Recent awards */}
      <div className="ek-panel p-5">
        <h2 className="ek-section-title">Recent Awards</h2>
        {recentAwards.length === 0 ? (
          <p className="text-stone-500 text-sm text-center py-4">No recent point awards.</p>
        ) : (
          <div className="space-y-1">
            {recentAwards.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-stone-800/50 rounded-md">
                <div>
                  <p className="text-sm text-stone-200">{a.reason}</p>
                  <p className="text-xs text-stone-500">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-sm font-bold ${a.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {a.points >= 0 ? '+' : ''}{a.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagePointTypes({
  eventTypes, userId, onBack, onChanged,
}: {
  eventTypes: PointEventType[];
  userId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PointEventType | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this point event type?')) return;
    await supabase.from('point_event_types').delete().eq('id', id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-200">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          Manage Point Event Types
        </h1>
      </div>

      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="ek-btn ek-btn-gold flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Event Type
        </button>
      </div>

      {eventTypes.length === 0 ? (
        <div className="ek-panel p-12 text-center">
          <Award className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400">No event types yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventTypes.map((r) => (
            <div key={r.id} className="ek-panel p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-100">{r.reason}</p>
                <p className="text-xs text-stone-500">{r.event_type}</p>
              </div>
              <span className={`text-lg font-bold ${r.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {r.points >= 0 ? '+' : ''}{r.points}
              </span>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(r); setShowForm(true); }} className="text-stone-400 hover:text-amber-400 p-1">
                  <Settings className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(r.id)} className="text-stone-400 hover:text-red-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PointTypeModal
          eventType={editing}
          userId={userId}
          nextSortOrder={eventTypes.length}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function PointTypeModal({
  eventType, userId, nextSortOrder, onClose, onSaved,
}: {
  eventType: PointEventType | null;
  userId: string;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(eventType?.reason || '');
  const [points, setPoints] = useState(eventType?.points ?? 0);
  const [eventTypeKey, setEventTypeKey] = useState(eventType?.event_type || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!reason.trim()) { setError('Reason is required.'); return; }
    if (!eventTypeKey.trim()) { setError('Event type key is required.'); return; }
    if (points === 0) { setError('Points cannot be 0.'); return; }

    setSaving(true);
    const label = `${reason.trim()} (${points >= 0 ? '+' : ''}${points})`;

    if (eventType) {
      const { error: e } = await supabase
        .from('point_event_types')
        .update({
          reason: reason.trim(),
          points,
          event_type: eventTypeKey.trim(),
          label,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventType.id);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('point_event_types').insert({
        reason: reason.trim(),
        points,
        event_type: eventTypeKey.trim(),
        label,
        sort_order: nextSortOrder,
        created_by: userId,
      });
      if (e) { setError(e.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="ek-panel max-w-md w-full p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-400">{eventType ? 'Edit Event Type' : 'Add Event Type'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="ek-label">Reason (shown to users)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="ek-input w-full" placeholder="e.g., Attended a training" maxLength={100} />
          </div>
          <div>
            <label className="ek-label">Points (negative for deductions)</label>
            <input type="number" value={points} onChange={(e) => setPoints(parseInt(e.target.value) || 0)} className="ek-input w-full" />
          </div>
          <div>
            <label className="ek-label">Event Type Key (unique, no spaces)</label>
            <input
              value={eventTypeKey}
              onChange={(e) => setEventTypeKey(e.target.value.replace(/\s+/g, '_').toLowerCase())}
              className="ek-input w-full"
              placeholder="e.g., training_attend"
              maxLength={50}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleSave} disabled={saving} className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {eventType ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
