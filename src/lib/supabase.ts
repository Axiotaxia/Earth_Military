import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const ROBLOX_CLIENT_ID = '4235495123293811435';
export const ROBLOX_GROUP_ID = 592750791;
export const OWNER_ROBLOX_ID = 593587739;

/** Minimum Roblox group rank required to onboard or use the site: Private. */
export const MIN_SITE_ACCESS_RANK = 2;

export const ROBLOX_RANKS: { rank: number; name: string }[] = [
  { rank: 0, name: 'Guest' },
  { rank: 1, name: 'Citizen' },
  { rank: 2, name: 'Private' },
  { rank: 3, name: 'Soldier' },
  { rank: 4, name: 'Corporal' },
  { rank: 5, name: 'Sergeant' },
  { rank: 6, name: 'Lieutenant' },
  { rank: 7, name: 'Captain' },
  { rank: 8, name: 'General' },
  { rank: 9, name: 'High Council' },
  { rank: 10, name: 'Royal Guard' },
  { rank: 11, name: 'Agent' },
  { rank: 12, name: 'Commander' },
  { rank: 13, name: 'Grand Secretariat' },
  { rank: 14, name: 'Princess' },
  { rank: 15, name: 'Prince' },
  { rank: 16, name: 'King' },
  { rank: 254, name: 'GroupRank' },
  { rank: 255, name: 'Holder' },
];

export const TIMEZONES = [
  'UTC',
  'EST (UTC-5)',
  'CST (UTC-6)',
  'MST (UTC-7)',
  'PST (UTC-8)',
  'AKST (UTC-9)',
  'HST (UTC-10)',
  'GMT (UTC+0)',
  'CET (UTC+1)',
  'EET (UTC+2)',
  'MSK (UTC+3)',
  'IST (UTC+5:30)',
  'CST China (UTC+8)',
  'JST (UTC+9)',
  'AEST (UTC+10)',
  'NZST (UTC+12)',
  'AST (UTC-4)',
  'BRT (UTC-3)',
] as const;

export const PATHS = [
  'Guard Path',
  'High Rank Path',
] as const;

export const PATH_DESCRIPTIONS: Record<string, string> = {
  'Guard Path': 'Dedicate yourself to the protection of the Earth Kingdom and its royal family, serving as a defender of the Kingdom.',
  'High Rank Path': "Earn your place among the Earth Kingdom's leadership through dedication, activity, and diplomatic skill, rising through the ranks of the kingdom.",
};

export const SUBS = [
  'Lava',
  'Metal',
  'Sand',
  'Non Bending',
] as const;

export interface DbUser {
  id: string;
  roblox_user_id: number;
  roblox_username: string;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  group_rank: number;
  group_rank_name: string;
  timezone: string | null;
  selected_path: string | null;
  main_sub: string | null;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Division {
  id: string;
  name: string;
  icon: string | null;
  logo_url: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DivisionRank {
  id: string;
  division_id: string;
  name: string;
  hierarchy: number;
  can_create_divisions: boolean;
  can_create_ranks: boolean;
  can_promote: boolean;
  can_award_points: boolean;
  can_view_hr_panel: boolean;
  can_manage_members: boolean;
  can_edit_point_types: boolean;
  created_at: string;
}

export interface DivisionMember {
  id: string;
  user_id: string;
  division_id: string;
  division_rank_id: string | null;
  joined_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  awarded_by: string | null;
  points: number;
  reason: string;
  event_type: string | null;
  created_at: string;
}

/**
 * "Recent points" resets every 2 weeks, anchored to Friday 2026-09-18 (the last
 * reset at the time this was added). Boundaries repeat every 14 days from there,
 * matching the get_current_points_cycle_start SQL function used server-side.
 */
export const POINTS_CYCLE_ANCHOR = new Date('2026-09-18T00:00:00Z');
export const POINTS_CYCLE_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

export function getCurrentPointsCycleStart(now: Date = new Date()): Date {
  const elapsed = now.getTime() - POINTS_CYCLE_ANCHOR.getTime();
  const cyclesSinceAnchor = Math.floor(elapsed / POINTS_CYCLE_LENGTH_MS);
  return new Date(POINTS_CYCLE_ANCHOR.getTime() + cyclesSinceAnchor * POINTS_CYCLE_LENGTH_MS);
}

export function getNextPointsResetDate(now: Date = new Date()): Date {
  return new Date(getCurrentPointsCycleStart(now).getTime() + POINTS_CYCLE_LENGTH_MS);
}

export interface UserPermissions {
  id: string;
  user_id: string;
  can_create_divisions: boolean;
  can_create_ranks: boolean;
  can_promote: boolean;
  can_award_points: boolean;
  can_view_hr_panel: boolean;
  can_manage_members: boolean;
  can_edit_point_types: boolean;
  is_owner: boolean;
}

export interface PointEventType {
  id: string;
  label: string;
  reason: string;
  points: number;
  event_type: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupRankPermissions {
  id: string;
  group_rank: number;
  can_create_divisions: boolean;
  can_create_ranks: boolean;
  can_promote: boolean;
  can_award_points: boolean;
  can_view_hr_panel: boolean;
  can_manage_members: boolean;
  can_edit_point_types: boolean;
  created_at: string;
  updated_at: string;
}

export const SUB_ELEMENTS = ['Base', 'Lava', 'Metal', 'Sand'] as const;
export type SubElement = typeof SUB_ELEMENTS[number];

export const SUB_ELEMENT_COLORS: Record<SubElement, { text: string; bg: string; border: string; dot: string }> = {
  Base: { text: 'text-stone-300', bg: 'bg-stone-700/20', border: 'border-stone-600/40', dot: 'bg-stone-400' },
  Lava: { text: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-700/40', dot: 'bg-orange-500' },
  Metal: { text: 'text-sky-300', bg: 'bg-sky-900/20', border: 'border-sky-700/40', dot: 'bg-sky-400' },
  Sand: { text: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-700/40', dot: 'bg-yellow-500' },
};

export interface Skill {
  id: string;
  title: string;
  description: string;
  sub_element: SubElement;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillStat {
  id: string;
  skill_id: string;
  name: string;
  is_scaling: boolean;
  base_value: number;
  scale_value: number;
  static_value: number;
  min_value: number | null;
  max_value: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}
