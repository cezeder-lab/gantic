import { useGanticStore } from '../../store/useGanticStore';
import type { Role } from '../../types';
import { effectiveRole } from './permissions';

/** The current user's role on a project. Outside a team workspace everyone
 * is admin of their own data; inside one, nothing is editable until the
 * first sync has finished (edits made before then would be overwritten). */
export function useProjectRole(projectId: string | null | undefined): Role {
  const workspace = useGanticStore((s) => s.workspace);
  const syncReady = useGanticStore((s) => s.syncReady);
  const project = useGanticStore((s) => (projectId ? s.projects.find((p) => p.id === projectId) : undefined));
  if (!workspace) return 'admin';
  if (!syncReady) return 'viewer';
  if (!project) return 'editor';
  return effectiveRole(project.roles, project.defaultRole, workspace.userId);
}

export function useCanEdit(projectId: string | null | undefined): boolean {
  return useProjectRole(projectId) !== 'viewer';
}
