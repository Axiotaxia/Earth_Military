import { useEffect, useState } from 'react';
import { supabase, GroupRankPermissions, ROBLOX_RANKS } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import {
  ShieldAlert, Save, Loader2, Check, ChevronDown, ChevronRight as ChevronRightIcon,
} from 'lucide-react';

const PERM_FIELDS: { key: keyof Omit<GroupRankPermissions, 'id' | 'group_rank' | 'created_at' | 'updated_at'>; label: string }[] = [
  { key: 'can_create_divisions', label: 'Can create divisions' },
  { key: 'can_create_ranks', label: 'Can create ranks' },
  { key: 'can_promote', label: 'Can promote members' },
  { key: 'can_award_points', label: 'Can award points' },
  { key: 'can_view_hr_panel', label: 'Can view HR panel' },
  { key: 'can_manage_members', label: 'Can manage members' },
  { key: 'can_edit_point_types', label: 'Can edit point event types' },
];

type PermKey = typeof PERM_FIELDS[number]['key'];

export function AdminPanel() {
  const perms = usePermissions();
  const [rankPerms, setRankPerms] = useState<Map<number, GroupRankPermissions>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    loadPerms();
  }, []);

  const loadPerms = async () => {
    setLoading(true);
    const { data } = await supabase.from('group_rank_permissions').select('*');
    setRankPerms(new Map((data || []).map((r) => [r.group_rank, r])));
    setLoading(false);
  };

  if (!perms.is_owner) {
    return (
      <div className="ek-panel p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">The Admin Panel is restricted to the site owner.</p>
      </div>
    );
  }

  const getRankPerm = (rank: number, key: PermKey): boolean => rankPerms.get(rank)?.[key] || false;

  const toggle = (rank: number, key: PermKey) => {
    setRankPerms((prev) => {
      const next = new Map(prev);
      const existing = next.get(rank);
      next.set(rank, {
        id: existing?.id || '',
        group_rank: rank,
        can_create_divisions: existing?.can_create_divisions || false,
        can_create_ranks: existing?.can_create_ranks || false,
        can_promote: existing?.can_promote || false,
        can_award_points: existing?.can_award_points || false,
        can_view_hr_panel: existing?.can_view_hr_panel || false,
        can_manage_members: existing?.can_manage_members || false,
        can_edit_point_types: existing?.can_edit_point_types || false,
        created_at: existing?.created_at || '',
        updated_at: existing?.updated_at || '',
        [key]: !(existing?.[key] || false),
      });
      return next;
    });
  };

  const handleSave = async (rank: number) => {
    const current = rankPerms.get(rank);
    if (!current) return;
    setSaving(rank);

    const { error } = await supabase
      .from('group_rank_permissions')
      .upsert({
        group_rank: rank,
        can_create_divisions: current.can_create_divisions,
        can_create_ranks: current.can_create_ranks,
        can_promote: current.can_promote,
        can_award_points: current.can_award_points,
        can_view_hr_panel: current.can_view_hr_panel,
        can_manage_members: current.can_manage_members,
        can_edit_point_types: current.can_edit_point_types,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'group_rank' });

    setSaving(null);
    if (!error) {
      setSaved(rank);
      setTimeout(() => setSaved(null), 1500);
      loadPerms();
    }
  };

  const hasAnyPerm = (rank: number) => {
    const p = rankPerms.get(rank);
    if (!p) return false;
    return PERM_FIELDS.some((f) => p[f.key]);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
        Admin Panel
      </h1>
      <p className="text-sm text-stone-400">
        Grant permissions to everyone holding a specific Roblox group rank, regardless of their division.
        Owner-only setting.
      </p>

      {loading ? (
        <div className="text-center py-12 text-stone-500">Loading...</div>
      ) : (
        <div className="ek-panel divide-y divide-stone-800">
          {ROBLOX_RANKS.map((r) => {
            const isExpanded = expandedRank === r.rank;
            return (
              <div key={r.rank} className="p-4">
                <button
                  onClick={() => setExpandedRank(isExpanded ? null : r.rank)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-stone-500" /> : <ChevronRightIcon className="w-4 h-4 text-stone-500" />}
                    <span className="text-sm font-medium text-stone-100">{r.name}</span>
                    <span className="text-xs text-stone-500">Rank {r.rank}</span>
                  </div>
                  {hasAnyPerm(r.rank) && (
                    <span className="ek-badge bg-green-900/30 text-green-400 border border-green-700/30 text-xs">
                      Has permissions
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-4 pl-6 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2">
                      {PERM_FIELDS.map((f) => (
                        <label key={f.key} className="flex items-center gap-2 text-sm text-stone-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={getRankPerm(r.rank, f.key)}
                            onChange={() => toggle(r.rank, f.key)}
                            className="w-4 h-4 rounded accent-green-600"
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => handleSave(r.rank)}
                      disabled={saving === r.rank}
                      className="ek-btn ek-btn-primary text-sm flex items-center gap-2"
                    >
                      {saving === r.rank ? <Loader2 className="w-4 h-4 animate-spin" /> : saved === r.rank ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {saved === r.rank ? 'Saved!' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
