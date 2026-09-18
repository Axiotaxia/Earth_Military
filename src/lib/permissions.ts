import { useAuth } from '@/context/AuthContext';
import { supabase, UserPermissions, DivisionMember, DivisionRank } from '@/lib/supabase';

export interface ResolvedPermissions {
  can_create_divisions: boolean;
  can_create_ranks: boolean;
  can_promote: boolean;
  can_award_points: boolean;
  can_view_hr_panel: boolean;
  can_manage_members: boolean;
  can_edit_point_types: boolean;
  is_owner: boolean;
}

export function usePermissions(): ResolvedPermissions {
  const { user } = useAuth();

  if (!user) {
    return {
      can_create_divisions: false,
      can_create_ranks: false,
      can_promote: false,
      can_award_points: false,
      can_view_hr_panel: false,
      can_manage_members: false,
      can_edit_point_types: false,
      is_owner: false,
    };
  }

  if (user.is_owner) {
    return {
      can_create_divisions: true,
      can_create_ranks: true,
      can_promote: true,
      can_award_points: true,
      can_view_hr_panel: true,
      can_manage_members: true,
      can_edit_point_types: true,
      is_owner: true,
    };
  }

  const perms = user.permissions;
  return {
    can_create_divisions: perms?.can_create_divisions || false,
    can_create_ranks: perms?.can_create_ranks || false,
    can_promote: perms?.can_promote || false,
    can_award_points: perms?.can_award_points || false,
    can_view_hr_panel: perms?.can_view_hr_panel || false,
    can_manage_members: perms?.can_manage_members || false,
    can_edit_point_types: perms?.can_edit_point_types || false,
    is_owner: false,
  };
}

export async function getDivisionPermissions(
  userId: string
): Promise<ResolvedPermissions | null> {
  const { data: member } = await supabase
    .from('division_members')
    .select('division_rank_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!member?.division_rank_id) return null;

  const { data: rank } = await supabase
    .from('division_ranks')
    .select('*')
    .eq('id', member.division_rank_id)
    .maybeSingle();

  if (!rank) return null;

  return {
    can_create_divisions: rank.can_create_divisions,
    can_create_ranks: rank.can_create_ranks,
    can_promote: rank.can_promote,
    can_award_points: rank.can_award_points,
    can_view_hr_panel: rank.can_view_hr_panel,
    can_manage_members: rank.can_manage_members,
    can_edit_point_types: rank.can_edit_point_types,
    is_owner: false,
  };
}

export function hasDivisionPermission(
  rankPerms: ResolvedPermissions | null,
  perm: keyof Omit<ResolvedPermissions, 'is_owner'>
): boolean {
  if (!rankPerms) return false;
  return rankPerms[perm];
}
