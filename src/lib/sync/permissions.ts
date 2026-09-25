import type { Role } from '../../types';

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

/** The same rule is applied when replaying the log (to decide which changes
 * count) and in the UI (to decide what to let the user do), so both always
 * agree. A project nobody is admin of lets its editors manage it, so access
 * can never become permanently stuck. */
export function effectiveRole(
  roles: Record<string, Role> | undefined,
  defaultRole: 'editor' | 'viewer' | undefined,
  userId: string,
): Role {
  const explicit = roles?.[userId];
  const role: Role = explicit ?? defaultRole ?? 'editor';
  if (role === 'editor' && !Object.values(roles ?? {}).includes('admin')) return 'admin';
  return role;
}

export function atLeast(role: Role, needed: Role): boolean {
  return RANK[role] >= RANK[needed];
}

// Changing any of these on a project needs admin; everything else needs editor.
export const ADMIN_PROJECT_FIELDS = new Set(['roles', 'defaultRole', '_deleted']);

export function normalizeUserId(email: string): string {
  return email.trim().toLowerCase();
}
