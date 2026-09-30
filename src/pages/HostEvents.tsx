import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase, DiscordMemberResult, HostedEvent, EventCohostSlot } from '@/lib/supabase';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { DiscordMemberPicker } from '@/components/DiscordMemberPicker';
import { callHostEvents } from '@/lib/hostEventsApi';
import { formatPersonName } from '@/lib/names';
import {
  Swords, Calendar, Loader2, Check, Users, ShieldAlert, ArrowLeft, RefreshCw, Trophy, Play, Ban, UserMinus, AlertTriangle,
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
  const [myEvents, setMyEvents] = useState<HostedEvent[]>([]);

  useEffect(() => {
    if (!user || screen !== 'pick') return;
    supabase
      .from('events')
      .select('*')
      .eq('host_user_id', user.id)
      .in('status', ['posted', 'started'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setMyEvents(data || []));
  }, [user, screen]);

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

      {myEvents.length > 0 && (
        <div className="ek-panel p-4">
          <h2 className="ek-section-title">Your active events</h2>
          <div className="space-y-2">
            {myEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => { setActiveEventId(ev.id); setScreen('status'); }}
                className="w-full flex items-center justify-between p-2 bg-stone-800/50 rounded-md hover:bg-stone-800 text-left"
              >
                <span className="text-sm text-stone-200">
                  {EVENT_TYPE_LABELS[ev.event_type]} &middot; {new Date(ev.scheduled_for).toLocaleString()}
                </span>
                <span className="text-xs text-amber-400 capitalize">{ev.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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

const EXAM_NAMES: Record<'slot_1' | 'slot_2', string> = {
  slot_1: 'Citizen \u2192 Private',
  slot_2: 'Private \u2192 Soldier',
};

type Selection = { slot_1: boolean; slot_2: boolean };

/** Both exams run if both got votes; if only one did, that one; if nobody voted, offer both. */
function suggestSelection(votes: { slot_1: number; slot_2: number }): Selection {
  if (votes.slot_1 > 0 && votes.slot_2 === 0) return { slot_1: true, slot_2: false };
  if (votes.slot_2 > 0 && votes.slot_1 === 0) return { slot_1: false, slot_2: true };
  return { slot_1: true, slot_2: true };
}


type PickedMember = DiscordMemberResult;

function MemberListPicker({
  label,
  members,
  onAdd,
  onRemove,
}: {
  label: string;
  members: PickedMember[];
  onAdd: (member: PickedMember) => void;
  onRemove: (discordId: string) => void;
}) {
  return (
    <div>
      <label className="ek-label">{label}</label>
      <DiscordMemberPicker
        placeholder="Type a Main server name..."
        onSelect={(member) => onAdd(member)}
      />
      {members.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {members.map((member) => (
            <button
              key={member.discordId}
              onClick={() => onRemove(member.discordId)}
              className="px-2 py-1 rounded bg-stone-800 border border-stone-700 text-xs text-stone-200 hover:border-red-700"
              title="Remove"
            >
              {formatPersonName(member.displayName, member.username)} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DoubleExamConclusionForm({
  event,
  slots,
  onConcluded,
}: {
  event: HostedEvent;
  slots: EventCohostSlot[];
  onConcluded: () => Promise<void>;
}) {
  const enabled1 = !!event.decided_activities?.slot_1;
  const enabled2 = !!event.decided_activities?.slot_2;
  const [passed1, setPassed1] = useState<PickedMember[]>([]);
  const [passed2, setPassed2] = useState<PickedMember[]>([]);
  const [guards, setGuards] = useState<PickedMember[]>([]);
  const [spectators, setSpectators] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addUnique = (setter: Dispatch<SetStateAction<PickedMember[]>>) => (member: PickedMember) => {
    setter((current) => current.some((m) => m.discordId === member.discordId) ? current : [...current, member]);
  };
  const remove = (setter: React.Dispatch<React.SetStateAction<PickedMember[]>>) => (discordId: string) => {
    setter((current) => current.filter((m) => m.discordId !== discordId));
  };

  const conclude = async () => {
    setBusy(true);
    setError(null);
    try {
      await callHostEvents('conclude-double-exam', {
        eventId: event.id,
        passed: {
          slot_1: passed1.map((m) => m.discordId),
          slot_2: passed2.map((m) => m.discordId),
        },
        guards: guards.map((m) => m.discordId),
        spectators: spectators.map((m) => m.discordId),
      });
      await onConcluded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not conclude the event.');
    } finally {
      setBusy(false);
    }
  };

  const cohost1 = slots.find((s) => s.slot_index === 1)?.claimed_by_discord_id;
  const cohost2 = slots.find((s) => s.slot_index === 2)?.claimed_by_discord_id;

  return (
    <div className="ek-panel p-4 space-y-4">
      <div>
        <h2 className="ek-section-title flex items-center gap-2"><Trophy className="w-4 h-4" /> Conclude Double Exam</h2>
        <p className="text-xs text-stone-500">Search names from the Main server. Co-hosts are already filled from the Discord claims.</p>
      </div>

      {enabled1 && (
        <div className="space-y-3 p-3 bg-stone-800/30 rounded-md">
          <div>
            <p className="text-sm font-semibold text-stone-200">Private Exam</p>
            <p className="text-xs text-stone-500">Co-Host: {cohost1 ? 'Claimed' : 'None'}</p>
          </div>
          <MemberListPicker label="Passed" members={passed1} onAdd={addUnique(setPassed1)} onRemove={remove(setPassed1)} />
        </div>
      )}

      {enabled2 && (
        <div className="space-y-3 p-3 bg-stone-800/30 rounded-md">
          <div>
            <p className="text-sm font-semibold text-stone-200">Soldier Exam</p>
            <p className="text-xs text-stone-500">Co-Host: {cohost2 ? 'Claimed' : 'None'}</p>
          </div>
          <MemberListPicker label="Passed" members={passed2} onAdd={addUnique(setPassed2)} onRemove={remove(setPassed2)} />
        </div>
      )}

      <MemberListPicker label="Guards (+2 points each)" members={guards} onAdd={addUnique(setGuards)} onRemove={remove(setGuards)} />
      <MemberListPicker label="Spectators" members={spectators} onAdd={addUnique(setSpectators)} onRemove={remove(setSpectators)} />

      {error && <div className="text-sm text-red-400 bg-red-950/20 border border-red-900/40 rounded p-3">{error}</div>}

      <button
        onClick={() => {
          if (confirm('Conclude this Double Exam? The Discord conclusion will be posted and guard/co-host points will be awarded.')) conclude();
        }}
        disabled={busy}
        className="ek-btn ek-btn-gold w-full flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {busy ? 'Concluding...' : 'Conclude Double Exam'}
      </button>
    </div>
  );
}

function EventStatusScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const [event, setEvent] = useState<HostedEvent | null>(null);
  const [slots, setSlots] = useState<EventCohostSlot[]>([]);
  const [voteCounts, setVoteCounts] = useState<{ slot_1: number; slot_2: number }>({ slot_1: 0, slot_2: 0 });
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
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

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !event) {
    return <div className="text-center py-12 text-stone-500">Loading event...</div>;
  }

  if (!event) {
    return (
      <div className="ek-panel p-12 text-center">
        <p className="text-stone-400">This event no longer exists (it may have been cancelled).</p>
        <button onClick={onBack} className="ek-btn ek-btn-ghost mt-4">Back to Host Events</button>
      </div>
    );
  }

  const chosen = selection ?? suggestSelection(voteCounts);
  const anyChosen = chosen.slot_1 || chosen.slot_2;
  const isPosted = event.status === 'posted';
  const slotFor = (key: 'slot_1' | 'slot_2') => slots.find((sl) => sl.slot_index === (key === 'slot_1' ? 1 : 2));

  const statusTitle: Record<string, string> = {
    draft: 'Not posted', posted: 'Posted', ready: 'Ready', started: 'In progress', concluded: 'Concluded', cancelled: 'Cancelled',
  };

  return (
    <div className="space-y-4 max-w-lg">
      <button onClick={onBack} className="text-stone-400 hover:text-stone-200 flex items-center gap-1 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
          Double Exam &mdash; {statusTitle[event.status] || event.status}
        </h1>
        <button onClick={load} className="text-stone-400 hover:text-stone-200 p-1" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <div className="ek-panel p-3 border border-red-800/50 text-sm text-red-400">{error}</div>}

      {isPosted && (
        <div className="ek-panel p-4">
          <h2 className="ek-section-title flex items-center gap-2"><Trophy className="w-4 h-4" /> Live Votes</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['slot_1', 'slot_2'] as const).map((key) => (
              <div key={key} className="bg-stone-800/50 rounded-md p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{voteCounts[key]}</p>
                <p className="text-xs text-stone-500">{EXAM_NAMES[key]}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-3">Auto-refreshes every 10 seconds.</p>
        </div>
      )}

      <div className="ek-panel p-4">
        <h2 className="ek-section-title flex items-center gap-2"><Users className="w-4 h-4" /> Co-Hosts</h2>
        <div className="space-y-2">
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between gap-2 p-2 bg-stone-800/50 rounded-md">
              <span className="text-sm text-stone-300">{slot.label}</span>
              {slot.claimed_by_discord_id ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-green-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {formatPersonName(slot.claimed_by_discord_username, null)}
                  </span>
                  {isPosted && (
                    <button
                      onClick={() => {
                        if (confirm('Remove this co-host from the spot? Someone else can then claim it.')) {
                          run(`unclaim-${slot.slot_index}`, () => callHostEvents('force-unclaim', { eventId, slotIndex: slot.slot_index }));
                        }
                      }}
                      disabled={busy !== null}
                      className="text-stone-500 hover:text-red-400 p-1"
                      title="Force unclaim"
                    >
                      {busy === `unclaim-${slot.slot_index}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                    </button>
                  )}
                </span>
              ) : (
                <span className="text-xs text-stone-500">Open</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isPosted && (
        <div className="ek-panel p-4">
          <h2 className="ek-section-title flex items-center gap-2"><Play className="w-4 h-4" /> Decide &amp; Start</h2>
          <p className="text-xs text-stone-500 mb-3">
            Selected automatically from the votes (both if both got votes, otherwise the one that did). Change it if you want.
          </p>

          <div className="space-y-2">
            {(['slot_1', 'slot_2'] as const).map((key) => {
              const warnings: string[] = [];
              if (chosen[key] && voteCounts[key] === 0) warnings.push('no votes');
              if (chosen[key] && !slotFor(key)?.claimed_by_discord_id) warnings.push('no co-host yet');
              return (
                <label key={key} className="flex items-start gap-2 p-2 bg-stone-800/50 rounded-md cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chosen[key]}
                    onChange={(e) => setSelection({ ...chosen, [key]: e.target.checked })}
                    className="w-4 h-4 rounded accent-green-600 mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="text-sm text-stone-200">{EXAM_NAMES[key]}</span>
                    {warnings.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                        <AlertTriangle className="w-3 h-3" /> {warnings.join(', ')}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <button
            onClick={() => run('start', () => callHostEvents('start-event', { eventId, activities: chosen }))}
            disabled={busy !== null || !anyChosen}
            className="ek-btn ek-btn-gold w-full mt-4 flex items-center justify-center gap-2"
          >
            {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start Event
          </button>
          <p className="text-xs text-stone-500 mt-2">
            Posts the &ldquo;commencing&rdquo; announcement in the events channel. The exam poll remains visible.
          </p>

          <button
            onClick={() => {
              if (confirm('Cancel this event? The poll and co-host request will be deleted.')) {
                run('cancel', () => callHostEvents('cancel-event', { eventId }));
              }
            }}
            disabled={busy !== null}
            className="ek-btn ek-btn-danger w-full mt-3 flex items-center justify-center gap-2"
          >
            {busy === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Cancel Event
          </button>
        </div>
      )}

      {event.status === 'started' && (
        <>
          <DoubleExamConclusionForm
            event={event}
            slots={slots}
            onConcluded={load}
          />
          <div className="ek-panel p-4">
            <h2 className="ek-section-title flex items-center gap-2"><Play className="w-4 h-4" /> Event Started</h2>
            <p className="text-sm text-stone-300">
              Running:{' '}
              {(['slot_1', 'slot_2'] as const).filter((k) => event.decided_activities?.[k]).map((k) => EXAM_NAMES[k]).join(' and ')}
            </p>
            <p className="text-xs text-stone-500 mt-2">Enter the results below, then conclude the event.</p>
          </div>
        </>
      )}

    </div>
  );
}
