import { useEffect, useState } from 'react';
import { supabase, Division, DivisionRank } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Shield, Plus, X, Save, Loader2, Trash2, ChevronUp, ChevronDown, Settings,
} from 'lucide-react';

export function DivisionRanks() {
  const perms = usePermissions();
  const { user } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDiv, setSelectedDiv] = useState<Division | null>(null);
  const [ranks, setRanks] = useState<DivisionRank[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRank, setEditingRank] = useState<DivisionRank | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('divisions').select('*').order('name');
      setDivisions(data || []);
      if (data && data.length > 0) setSelectedDiv(data[0]);
    })();
  }, []);

  useEffect(() => {
    if (!selectedDiv) return;
    (async () => {
      const { data } = await supabase
        .from('division_ranks')
        .select('*')
        .eq('division_id', selectedDiv.id)
        .order('hierarchy', { ascending: false });
      setRanks(data || []);
    })();
  }, [selectedDiv]);

  const handleDelete = async (rankId: string) => {
    if (!confirm('Delete this rank?')) return;
    await supabase.from('division_ranks').delete().eq('id', rankId);
    setRanks(ranks.filter((r) => r.id !== rankId));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
        Division Ranks
      </h1>

      {/* Division selector */}
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

      {selectedDiv && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-200">{selectedDiv.name} Ranks</h2>
            {perms.can_create_ranks && (
              <button onClick={() => setShowCreate(true)} className="ek-btn ek-btn-gold flex items-center gap-2 text-sm">
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
                  <div className="flex flex-col">
                    <span className="text-xs text-stone-500 text-center">H{r.hierarchy}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-stone-100">{r.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.can_create_divisions && <Perm label="Create Div" />}
                      {r.can_create_ranks && <Perm label="Create Ranks" />}
                      {r.can_promote && <Perm label="Promote" />}
                      {r.can_award_points && <Perm label="Award Points" />}
                      {r.can_view_hr_panel && <Perm label="HR Panel" />}
                      {r.can_manage_members && <Perm label="Manage Members" />}
                    </div>
                  </div>
                  {perms.can_create_ranks && (
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
        </>
      )}

      {showCreate && selectedDiv && (
        <RankModal
          division={selectedDiv}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            (async () => {
              const { data } = await supabase
                .from('division_ranks')
                .select('*')
                .eq('division_id', selectedDiv.id)
                .order('hierarchy', { ascending: false });
              setRanks(data || []);
            })();
          }}
        />
      )}

      {editingRank && (
        <RankModal
          division={selectedDiv!}
          rank={editingRank}
          onClose={() => setEditingRank(null)}
          onSaved={() => {
            setEditingRank(null);
            if (selectedDiv) {
              (async () => {
                const { data } = await supabase
                  .from('division_ranks')
                  .select('*')
                  .eq('division_id', selectedDiv.id)
                  .order('hierarchy', { ascending: false });
                setRanks(data || []);
              })();
            }
          }}
        />
      )}
    </div>
  );
}

function Perm({ label }: { label: string }) {
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
            <input
              type="number"
              value={hierarchy}
              onChange={(e) => setHierarchy(parseInt(e.target.value) || 0)}
              className="ek-input w-full"
            />
          </div>
          <div>
            <label className="ek-label">Permissions</label>
            <div className="space-y-2">
              {permFields.map((p) => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={perms[p.key]}
                    onChange={(e) => setPerms({ ...perms, [p.key]: e.target.checked })}
                    className="w-4 h-4 rounded accent-green-600"
                  />
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
