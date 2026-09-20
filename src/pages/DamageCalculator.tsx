import { useEffect, useMemo, useState } from 'react';
import {
  supabase, Skill, SkillStat, SUB_ELEMENTS, SUB_ELEMENT_COLORS, SubElement,
} from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Calculator, Search, Plus, Settings, Trash2, X, Save, Loader2, Swords, ChevronDown, ChevronUp,
} from 'lucide-react';

interface SkillWithStats extends Skill {
  stats: SkillStat[];
}

export function DamageCalculator() {
  const perms = usePermissions();
  const { user } = useAuth();
  const [skills, setSkills] = useState<SkillWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [strength, setStrength] = useState<number>(100);
  const [search, setSearch] = useState('');
  const [editingSkill, setEditingSkill] = useState<SkillWithStats | 'new' | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    const { data: skillRows } = await supabase.from('skills').select('*').order('sort_order');
    const { data: statRows } = await supabase.from('skill_stats').select('*').order('sort_order');

    const statsBySkill = new Map<string, SkillStat[]>();
    (statRows || []).forEach((s) => {
      const list = statsBySkill.get(s.skill_id) || [];
      list.push(s);
      statsBySkill.set(s.skill_id, list);
    });

    const enriched: SkillWithStats[] = (skillRows || []).map((s) => ({
      ...s,
      stats: statsBySkill.get(s.id) || [],
    }));

    setSkills(enriched);
    setLoading(false);
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm('Delete this skill and all its stats?')) return;
    await supabase.from('skills').delete().eq('id', id);
    loadSkills();
  };

  const handleReorder = async (group: SkillWithStats[], index: number, direction: -1 | 1) => {
    const other = group[index + direction];
    const current = group[index];
    if (!other) return;

    // Swap sort_order between the two skills, then re-sort the array itself so the
    // new order is reflected immediately (updating the field alone doesn't reorder
    // the existing array).
    setSkills((prev) => {
      const updated = prev.map((s) => {
        if (s.id === current.id) return { ...s, sort_order: other.sort_order };
        if (s.id === other.id) return { ...s, sort_order: current.sort_order };
        return s;
      });
      return [...updated].sort((a, b) => a.sort_order - b.sort_order);
    });

    await Promise.all([
      supabase.from('skills').update({ sort_order: other.sort_order }).eq('id', current.id),
      supabase.from('skills').update({ sort_order: current.sort_order }).eq('id', other.id),
    ]);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => skills.filter((s) => {
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  }), [skills, search]);

  const bySubElement = useMemo(() => {
    const map = new Map<SubElement, SkillWithStats[]>();
    SUB_ELEMENTS.forEach((el) => map.set(el, []));
    filtered.forEach((s) => {
      const list = map.get(s.sub_element) || [];
      list.push(s);
      map.set(s.sub_element, list);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-amber-400 flex items-center gap-2" style={{ fontFamily: 'Cinzel, serif' }}>
          <Calculator className="w-5 h-5" /> Damage Calculator
        </h1>
        {perms.is_owner && (
          <button onClick={() => setEditingSkill('new')} className="ek-btn ek-btn-gold flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Skill
          </button>
        )}
      </div>

      {/* Strength input */}
      <div className="ek-panel p-5">
        <label className="ek-label">Your Strength</label>
        <input
          type="number"
          value={strength}
          onChange={(e) => setStrength(Math.max(0, parseFloat(e.target.value) || 0))}
          className="ek-input w-full text-lg font-semibold"
          placeholder="Enter strength..."
        />
        <p className="text-xs text-stone-500 mt-2">
          All scaling stats below update automatically using this value.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="ek-input pl-9 w-full"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-500">Loading skills...</div>
      ) : filtered.length === 0 ? (
        <div className="ek-panel p-12 text-center">
          <Swords className="w-12 h-12 text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400">
            {skills.length === 0 ? 'No skills have been added yet.' : 'No skills match your search.'}
          </p>
          {perms.is_owner && skills.length === 0 && (
            <p className="text-stone-500 text-sm mt-1">Click "Add Skill" to get started.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {SUB_ELEMENTS.map((el) => {
            const elSkills = bySubElement.get(el) || [];
            if (elSkills.length === 0) return null;
            const colors = SUB_ELEMENT_COLORS[el];
            return (
              <div key={el}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                  <h2 className={`text-sm font-semibold uppercase tracking-wide ${colors.text}`}>{el}</h2>
                  <span className="text-xs text-stone-600">{elSkills.length}</span>
                </div>
                <div className="space-y-3">
                  {elSkills.map((skill, index) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      strength={strength}
                      colors={colors}
                      isOwner={perms.is_owner}
                      isExpanded={expanded.has(skill.id)}
                      onToggleExpand={() => toggleExpanded(skill.id)}
                      onEdit={() => setEditingSkill(skill)}
                      onDelete={() => handleDeleteSkill(skill.id)}
                      onMoveUp={!search.trim() && index > 0 ? () => handleReorder(elSkills, index, -1) : undefined}
                      onMoveDown={!search.trim() && index < elSkills.length - 1 ? () => handleReorder(elSkills, index, 1) : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingSkill && (
        <SkillEditorModal
          skill={editingSkill === 'new' ? null : editingSkill}
          userId={user!.id}
          nextSortOrder={skills.length}
          onClose={() => setEditingSkill(null)}
          onSaved={() => { setEditingSkill(null); loadSkills(); }}
        />
      )}
    </div>
  );
}

function computeStatValue(stat: SkillStat, strength: number): number {
  if (!stat.is_scaling) return stat.static_value;

  let value = stat.base_value + strength * stat.scale_value;
  if (stat.min_value !== null && value < stat.min_value) value = stat.min_value;
  if (stat.max_value !== null && value > stat.max_value) value = stat.max_value;
  return value;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '');
}

function SkillCard({
  skill, strength, colors, isOwner, isExpanded, onToggleExpand, onEdit, onDelete, onMoveUp, onMoveDown,
}: {
  skill: SkillWithStats;
  strength: number;
  colors: { text: string; bg: string; border: string; dot: string };
  isOwner: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const visibleStats = isExpanded ? skill.stats : skill.stats.slice(0, 6);

  return (
    <div className={`ek-panel p-4 border ${colors.border} ${colors.bg}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-stone-100 truncate">{skill.title}</h3>
          {skill.description && <p className="text-sm text-stone-400 mt-0.5">{skill.description}</p>}
        </div>
        {isOwner && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className="text-stone-400 hover:text-amber-400 p-1 disabled:opacity-25 disabled:hover:text-stone-400"
              title="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className="text-stone-400 hover:text-amber-400 p-1 disabled:opacity-25 disabled:hover:text-stone-400"
              title="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={onEdit} className="text-stone-400 hover:text-amber-400 p-1">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="text-stone-400 hover:text-red-400 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {skill.stats.length === 0 ? (
        <p className="text-stone-600 text-sm mt-3">No stats configured for this skill.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
            {visibleStats.map((stat) => {
              const rawValue = stat.is_scaling ? stat.base_value + strength * stat.scale_value : stat.static_value;
              const clampedValue = computeStatValue(stat, strength);
              const isCapped = stat.is_scaling && rawValue !== clampedValue;
              return (
                <div key={stat.id} className="bg-stone-900/50 rounded-md px-3 py-2">
                  <p className="text-xs text-stone-500">{stat.name}</p>
                  <p className={`text-lg font-bold ${colors.text}`}>
                    {formatNumber(clampedValue)}
                    {isCapped && <span className="text-xs text-stone-500 font-normal ml-1">(capped)</span>}
                  </p>
                </div>
              );
            })}
          </div>
          {skill.stats.length > 6 && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300 mt-3"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {isExpanded ? 'Show less' : `Show ${skill.stats.length - 6} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface StatDraft {
  id: string;
  name: string;
  is_scaling: boolean;
  base_value: string;
  scale_value: string;
  static_value: string;
  min_value: string;
  max_value: string;
}

function newStatDraft(): StatDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    is_scaling: true,
    base_value: '0',
    scale_value: '0',
    static_value: '0',
    min_value: '',
    max_value: '',
  };
}

function SkillEditorModal({
  skill, userId, nextSortOrder, onClose, onSaved,
}: {
  skill: SkillWithStats | null;
  userId: string;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(skill?.title || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [subElement, setSubElement] = useState<SubElement>(skill?.sub_element || 'Base');
  const [stats, setStats] = useState<StatDraft[]>(
    skill?.stats.map((s) => ({
      id: s.id,
      name: s.name,
      is_scaling: s.is_scaling,
      base_value: String(s.base_value),
      scale_value: String(s.scale_value),
      static_value: String(s.static_value),
      min_value: s.min_value === null ? '' : String(s.min_value),
      max_value: s.max_value === null ? '' : String(s.max_value),
    })) || [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStat = () => setStats([...stats, newStatDraft()]);
  const removeStat = (id: string) => setStats(stats.filter((s) => s.id !== id));
  const updateStat = (id: string, patch: Partial<StatDraft>) => {
    setStats(stats.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (stats.some((s) => !s.name.trim())) { setError('Every stat needs a name.'); return; }
    for (const s of stats) {
      if (s.is_scaling && s.min_value.trim() !== '' && s.max_value.trim() !== '') {
        const min = parseFloat(s.min_value);
        const max = parseFloat(s.max_value);
        if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
          setError(`"${s.name || 'A stat'}" has a min value greater than its max value.`);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);

    let skillId = skill?.id;

    if (skill) {
      const { error: e } = await supabase
        .from('skills')
        .update({
          title: title.trim(),
          description: description.trim(),
          sub_element: subElement,
          updated_at: new Date().toISOString(),
        })
        .eq('id', skill.id);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { data, error: e } = await supabase
        .from('skills')
        .insert({
          title: title.trim(),
          description: description.trim(),
          sub_element: subElement,
          sort_order: nextSortOrder,
          created_by: userId,
        })
        .select()
        .single();
      if (e || !data) { setError(e?.message || 'Failed to create skill.'); setSaving(false); return; }
      skillId = data.id;
    }

    if (!skillId) { setError('Something went wrong saving the skill.'); setSaving(false); return; }

    // Replace all stats for this skill (simplest correct approach for a small editable list)
    await supabase.from('skill_stats').delete().eq('skill_id', skillId);
    if (stats.length > 0) {
      const { error: statsError } = await supabase.from('skill_stats').insert(
        stats.map((s, i) => ({
          skill_id: skillId,
          name: s.name.trim(),
          is_scaling: s.is_scaling,
          base_value: parseFloat(s.base_value) || 0,
          scale_value: parseFloat(s.scale_value) || 0,
          static_value: parseFloat(s.static_value) || 0,
          min_value: s.min_value.trim() === '' ? null : parseFloat(s.min_value),
          max_value: s.max_value.trim() === '' ? null : parseFloat(s.max_value),
          sort_order: i,
        })),
      );
      if (statsError) { setError(statsError.message); setSaving(false); return; }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="ek-panel max-w-2xl w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-400">{skill ? 'Edit Skill' : 'Add Skill'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="ek-label">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="ek-input w-full" maxLength={80} />
            </div>
            <div>
              <label className="ek-label">Sub Element</label>
              <select value={subElement} onChange={(e) => setSubElement(e.target.value as SubElement)} className="ek-input w-full">
                {SUB_ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="ek-label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="ek-input w-full" rows={2} maxLength={300} />
          </div>

          <div className="pt-3 border-t border-stone-700">
            <div className="flex items-center justify-between mb-2">
              <label className="ek-label mb-0">Stats</label>
              <button onClick={addStat} className="ek-btn ek-btn-ghost text-xs flex items-center gap-1 py-1">
                <Plus className="w-3.5 h-3.5" /> Add Stat
              </button>
            </div>

            {stats.length === 0 ? (
              <p className="text-stone-600 text-sm">No stats yet. Add one above.</p>
            ) : (
              <div className="space-y-3">
                {stats.map((stat) => (
                  <div key={stat.id} className="bg-stone-900/50 rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={stat.name}
                        onChange={(e) => updateStat(stat.id, { name: e.target.value })}
                        placeholder="Stat name (e.g. Damage)"
                        className="ek-input flex-1"
                        maxLength={40}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-stone-400 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={stat.is_scaling}
                          onChange={(e) => updateStat(stat.id, { is_scaling: e.target.checked })}
                          className="w-4 h-4 rounded accent-green-600"
                        />
                        Scales with strength
                      </label>
                      <button onClick={() => removeStat(stat.id)} className="text-stone-500 hover:text-red-400 p-1 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {stat.is_scaling ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-stone-500">Base value</label>
                            <input
                              type="number"
                              value={stat.base_value}
                              onChange={(e) => updateStat(stat.id, { base_value: e.target.value })}
                              className="ek-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-stone-500">Scale (per strength)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={stat.scale_value}
                              onChange={(e) => updateStat(stat.id, { scale_value: e.target.value })}
                              className="ek-input w-full text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-stone-500">Min value (optional)</label>
                            <input
                              type="number"
                              value={stat.min_value}
                              onChange={(e) => updateStat(stat.id, { min_value: e.target.value })}
                              placeholder="No minimum"
                              className="ek-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-stone-500">Max value (optional)</label>
                            <input
                              type="number"
                              value={stat.max_value}
                              onChange={(e) => updateStat(stat.id, { max_value: e.target.value })}
                              placeholder="No maximum"
                              className="ek-input w-full text-sm"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="text-xs text-stone-500">Static value</label>
                        <input
                          type="number"
                          value={stat.static_value}
                          onChange={(e) => updateStat(stat.id, { static_value: e.target.value })}
                          className="ek-input w-full text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleSave} disabled={saving} className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {skill ? 'Update Skill' : 'Create Skill'}
          </button>
        </div>
      </div>
    </div>
  );
}
