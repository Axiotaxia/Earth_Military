import { useEffect, useState } from 'react';
import { supabase, DiscordMemberResult, HostedEvent, EventCohostSlot } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { DiscordMemberPicker } from '@/components/DiscordMemberPicker';
import { callHostEvents } from '@/lib/hostEventsApi';
import { formatPersonName } from '@/lib/names';
import {
  Swords, Calendar, Loader2, Check, Users, ShieldAlert, ArrowLeft, RefreshCw, Trophy,
} from 'lucide-react';

type EventTypeOption = 'corporal_exam' | 'private_exam' | 'soldier_exam' | 'double_exam' | 'training';

const EVENT_TYPE_LABELS: Record<EventTypeOption, string> = {
  corporal_exam: 'Corporal Exam',
  private_exam: 'Private Exam',
  soldier_exam: 'Soldier Exam',
  double_exam: 'Double Exam (Citizen + Private)',
  training: 'Training',
};

export function HostEvents() {
  const perms = usePermissions();
  const { user } = useAuth();
  const [screen, setScreen] = useState<'pick' | 'create' | 'status'>('pick');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  if (!perms.can_host_events) {
    return (
      <div className="ek-panel p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-stone-600 mx-auto mb-3" />
        <p className="text-stone-400">You do not have permission to host events.</p>
      </div>
    );
  }

  if (!user) return null;

  if (screen === 'status' && activeEventId) {
    return (
      <EventStatusScreen
        eventId={activeEventId}
        onBack={() => { setScreen('pick'); setActiveEventId(null); }}
      />
    );
  }

  if (screen === 'create') {
    return (
      <CreateDoubleExamScreen
        onBack={() => setScreen('pick')}
        onCreated={(eventId) => { setActiveEventId(eventId); setScreen('status'); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-amber-400 flex items-center gap-2" style={{ fontFamily: 'Cinzel, serif' }}>
        <Swords className="w-5 h-5" /> Host Events
      </h1>
      <p className="text-sm text-stone-400">Select what you'd like to host.</p>

      <div className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(EVENT_TYPE_LABELS) as EventTypeOption[]).map((type) => {
          const isReady = type === 'double_exam';
          return (
            <button
              key={type}
              disabled={!isReady}
              onClick={() => { if (isReady) setScreen('create'); }}
              className={`ek-panel p-5 text-left transition-all ${
                isReady ? 'hover:border-green-700/50 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <h3 className="text-base font-semibold text-stone-100">{EVENT_TYPE_LABELS[type]}</h3>
              <p className="text-xs text-stone-500 mt-1">
                {isReady ? 'Click to set up this event.' : 'Coming soon.'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CreateDoubleExamScreen({ onBack, onCreated }: { onBack: () => void; onCreated: (eventId: string) => void }) {
  const { user, refreshUser } = useAuth();
  const [timeValue, setTimeValue] = useState('');
  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDiscordMember, setSelectedDiscordMember] = useState<DiscordMemberResult | null>(null);

  if (!user) return null;

  const needsDiscordId = !user.discord_id;

  const handleSelectSelf = async (member: DiscordMemberResult) => {
    setError(null);
    try {
      await callHostEvents('set-discord-identity', { discordId: member.discordId, username: member.username });
      setSelectedDiscordMember(member);
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify that Discord account.');
    }
  };

  const handleCreate = async () => {
    const amount = parseFloat(timeValue);
    if (!amount || amount <= 0) {
      setError('Enter a valid amount of time.');
      return;
    }

    if (!user.discord_id && !selectedDiscordMember) {
      setError('Please identify yourself as a Discord member first.');
      return;
    }

    setSaving(true);
    setError(null);

    const multiplier = timeUnit === 'minutes' ? 60_000 : timeUnit === 'hours' ? 3_600_000 : 86_400_000;
    const scheduledFor = new Date(Date.now() + amount * multiplier);

    try {
      const data = await callHostEvents<{ eventId: string }>('create-double-exam', {
        scheduledFor: scheduledFor.toISOString(),
      });
      onCreated(data.eventId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <button onClick={onBack} className="text-stone-400 hover:text-stone-200 flex items-center gap-1 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
        Host Double Exam
      </h1>

      {needsDiscordId && !selectedDiscordMember && (
        <div className="ek-panel p-4">
          <label className="ek-label flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Identify yourself on Discord</label>
          <p className="text-xs text-stone-500 mb-2">
            We don't have your Discord ID on file yet. Search for yourself below so the poll can mention you as host.
          </p>
          <DiscordMemberPicker placeholder="Search your Discord name or username..." onSelect={handleSelectSelf} />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <p className="text-xs text-stone-600 mt-2">We check with Bloxlink that the account you pick is linked to your Roblox account.</p>
        </div>
      )}

      {(user.discord_id || selectedDiscordMember) && (
        <div className="ek-panel p-4">
          <label className="ek-label">Time until event</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              placeholder="e.g. 35"
              className="ek-input flex-1"
              min="1"
            />
            <select value={timeUnit} onChange={(e) => setTimeUnit(e.target.value as typeof timeUnit)} className="ek-input">
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="ek-btn ek-btn-gold w-full mt-4 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {saving ? 'Posting...' : 'Confirm & Post'}
          </button>
        </div>
      )}
    </div>
  );
}

function EventStatusScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const [event, setEvent] = useState<HostedEvent | null>(null);
  const [slots, setSlots] = useState<EventCohostSlot[]>([]);
  const [voteCounts, setVoteCounts] = useState<{ slot_1: number; slot_2: number }>({ slot_1: 0, slot_2: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: eventData } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    setEvent(eventData);

    const { data: slotData } = await supabase
      .from('event_cohost_slots')
      .select('*')
      .eq('event_id', eventId)
      .order('slot_index');
    setSlots(slotData || []);

    try {
      setVoteCounts(await callHostEvents<{ slot_1: number; slot_2: number }>('vote-counts', { eventId }));
    } catch {
      // Non-critical - vote counts just won't update this refresh
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (loading && !event) {
    return <div className="text-center py-12 text-stone-500">Loading event...</div>;
  }

  if (!event) {
    return (
      <div className="ek-panel p-12 text-center">
        <p className="text-stone-400">Event not found.</p>
        <button onClick={onBack} className="ek-btn ek-btn-ghost mt-4">Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <button onClick={onBack} className="text-stone-400 hover:text-stone-200 flex items-center gap-1 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          Double Exam &mdash; Posted
        </h1>
        <button onClick={load} className="text-stone-400 hover:text-stone-200 p-1" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="ek-panel p-4">
        <h2 className="ek-section-title flex items-center gap-2"><Trophy className="w-4 h-4" /> Live Votes</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-stone-800/50 rounded-md p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{voteCounts.slot_1}</p>
            <p className="text-xs text-stone-500">Citizen &rarr; Private</p>
          </div>
          <div className="bg-stone-800/50 rounded-md p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{voteCounts.slot_2}</p>
            <p className="text-xs text-stone-500">Private &rarr; Soldier</p>
          </div>
        </div>
        <p className="text-xs text-stone-500 mt-3">
          Auto-refreshes every 10 seconds. Votes are informational only &mdash; you'll decide which exam(s) to run on the next screen.
        </p>
      </div>

      <div className="ek-panel p-4">
        <h2 className="ek-section-title flex items-center gap-2"><Users className="w-4 h-4" /> Co-Hosts</h2>
        <div className="space-y-2">
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between p-2 bg-stone-800/50 rounded-md">
              <span className="text-sm text-stone-300">{slot.label}</span>
              {slot.claimed_by_discord_id ? (
                <span className="text-sm text-green-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {formatPersonName(slot.claimed_by_discord_username, null)}
                </span>
              ) : (
                <span className="text-xs text-stone-500">Open</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="ek-panel p-4 bg-stone-900/40">
        <p className="text-xs text-stone-500">
          The "decide which exam(s) ran / start / conclude" screens come next &mdash; not built yet in this phase.
        </p>
      </div>
    </div>
  );
}
