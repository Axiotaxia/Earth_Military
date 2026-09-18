import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Division } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import {
  Swords, Plus, Users, X, Save, Loader2, Image as ImageIcon,
} from 'lucide-react';

export function Divisions() {
  const { user } = useAuth();
  const perms = usePermissions();
  const navigate = useNavigate();
  const [divisions, setDivisions] = useState<(Division & { member_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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
              onClick={() => navigate(`/divisions/${d.id}`)}
              className="ek-panel p-5 text-left hover:border-green-700/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-md bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-2xl overflow-hidden">
                  {d.logo_url ? (
                    <img
                      src={d.logo_url}
                      alt={d.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    d.icon || <Swords className="w-6 h-6 text-amber-400" />
                  )}
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
    </div>
  );
}

function CreateDivisionModal({
  userId, onClose, onCreated,
}: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Division name is required.'); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from('divisions').insert({
      name: name.trim(),
      icon: icon.trim() || null,
      logo_url: logoUrl.trim() || null,
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
            <label className="ek-label">Icon (emoji or symbol, used as fallback)</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} className="ek-input w-full" placeholder="e.g., ⚔️" maxLength={10} />
          </div>
          <div>
            <label className="ek-label flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Logo Image URL (PNG, optional)
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
          <button onClick={handleCreate} disabled={saving} className="ek-btn ek-btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
