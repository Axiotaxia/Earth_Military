import { useAuth } from '@/context/AuthContext';

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

const NO_PERMISSIONS: ResolvedPermissions = {
  can_create_divisions: false,
  can_create_ranks: false,
  can_promote: false,
  can_award_points: false,
  can_view_hr_panel: false,
  can_manage_members: false,
  can_edit_point_types: false,
  is_owner: false,
};

/**
 * Returns the user's effective permissions: the union of their individual
 * user_permissions row, their Roblox group rank's permissions, and their
 * division rank's permissions. Any one of the three granting a permission
 * is enough (site owner always has everything).
 */
export function usePermissions(): ResolvedPermissions {
  const { user } = useAuth();

  if (!user) return NO_PERMISSIONS;

  return {
    ...user.effective_permissions,
    is_owner: user.is_owner,
  };
}
