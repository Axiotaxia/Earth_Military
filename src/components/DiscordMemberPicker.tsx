import { useEffect, useRef, useState } from 'react';
import { DiscordMemberResult } from '@/lib/supabase';
import { Search, Loader2, User } from 'lucide-react';

interface DiscordMemberPickerProps {
  placeholder?: string;
  onSelect: (member: DiscordMemberResult) => void;
}

/**
 * Searches the Main server's Discord members live as the user types, via the
 * search-discord-members edge function (which proxies to the bot's HTTP API,
 * keeping the bot's shared secret off the client).
 */
export function DiscordMemberPicker({ placeholder = 'Search Discord members...', onSelect }: DiscordMemberPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiscordMemberResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-discord-members?q=${encodeURIComponent(query.trim())}`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        });
        const data = await resp.json();
        setResults(data.members || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="ek-input pl-9 w-full"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto ek-panel border border-stone-700 shadow-xl">
          {results.map((m) => (
            <button
              key={m.discordId}
              onClick={() => {
                onSelect(m);
                setQuery('');
                setResults([]);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 hover:bg-stone-800/70 text-left"
            >
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center"><User className="w-3.5 h-3.5 text-stone-400" /></div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-stone-200 truncate">{m.displayName}</p>
                <p className="text-xs text-stone-500 truncate">@{m.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
