import { config } from './config.js';

const BASE_URL = `${config.supabaseUrl}/rest/v1`;

const headers = {
  apikey: config.supabaseServiceKey,
  Authorization: `Bearer ${config.supabaseServiceKey}`,
  'Content-Type': 'application/json',
};

/**
 * Minimal REST wrapper around Supabase's PostgREST API. Using the service
 * role key here bypasses RLS entirely, which is appropriate since this bot
 * process is a trusted backend, not a client the public can talk to directly.
 */
export const db = {
  async select(table, query = '') {
    const resp = await fetch(`${BASE_URL}/${table}?${query}`, { headers });
    if (!resp.ok) throw new Error(`Supabase select failed on ${table}: ${await resp.text()}`);
    return resp.json();
  },

  async insert(table, rows) {
    const resp = await fetch(`${BASE_URL}/${table}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(rows),
    });
    if (!resp.ok) throw new Error(`Supabase insert failed on ${table}: ${await resp.text()}`);
    return resp.json();
  },

  async update(table, query, patch) {
    const resp = await fetch(`${BASE_URL}/${table}?${query}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!resp.ok) throw new Error(`Supabase update failed on ${table}: ${await resp.text()}`);
    return resp.json();
  },

  async delete(table, query) {
    const resp = await fetch(`${BASE_URL}/${table}?${query}`, {
      method: 'DELETE',
      headers,
    });
    if (!resp.ok) throw new Error(`Supabase delete failed on ${table}: ${await resp.text()}`);
  },
};
