import { useMemo, useState, useSyncExternalStore } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { ROLES } from '../../types';
import type { Role } from '../../types';
import { syncEngine } from '../../lib/sync/engine';
import { effectiveRole, normalizeUserId } from '../../lib/sync/permissions';
import { useProjectRole } from '../../lib/sync/useProjectRole';

export function AccessDialog() {
  const projectId = useGanticStore((s) => s.accessProjectId);
  const setProjectId = useGanticStore((s) => s.setAccessProjectId);
  const project = useGanticStore((s) => s.projects.find((p) => p.id === projectId));
  const workspace = useGanticStore((s) => s.workspace);
  const presence = useGanticStore((s) => s.presence);
  const setProjectRole = useGanticStore((s) => s.setProjectRole);
  const setProjectDefaultRole = useGanticStore((s) => s.setProjectDefaultRole);
  const myRole = useProjectRole(projectId);
  const version = useSyncExternalStore(syncEngine.subscribeActivity, syncEngine.getActivityVersion);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('editor');

  const users = useMemo(() => {
    const known = syncEngine.knownUsers();
    for (const id of Object.keys(project?.roles ?? {})) if (!known.has(id)) known.set(id, id);
    return [...known.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    // `version` isn't read, but bumps whenever new log entries arrive.
  }, [project?.roles, presence, version]);

  if (!project || !workspace) return null;
  const isAdmin = myRole === 'admin';
  const defaultRole = project.defaultRole ?? 'editor';
  const roles = project.roles ?? {};

  function addPerson() {
    const id = normalizeUserId(newEmail);
    if (!id || !project) return;
    setProjectRole(project.id, id, newRole);
    setNewEmail('');
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setProjectId(null)} />
      <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Members &amp; access</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">{project.name}</p>
          </div>
          <button
            onClick={() => setProjectId(null)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {!isAdmin && (
            <p className="mb-4 rounded-md bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              Only admins of this project can change access. You are {myRole === 'editor' ? 'an editor' : 'a viewer'}.
            </p>
          )}

          <label className="mb-4 flex items-center justify-between gap-3 text-sm text-gray-700 dark:text-gray-200">
            <span>
              Everyone else in the workspace
              <span className="block text-xs text-gray-400 dark:text-gray-500">Anyone not listed below</span>
            </span>
            <select
              value={defaultRole}
              disabled={!isAdmin}
              onChange={(e) => setProjectDefaultRole(project.id, e.target.value as 'editor' | 'viewer')}
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm outline-none disabled:opacity-60"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>

          <ul className="mb-4 divide-y divide-gray-100 dark:divide-gray-700 rounded-md border border-gray-100 dark:border-gray-700">
            {users.map(([id, name]) => {
              const explicit = roles[id];
              const effective = effectiveRole(roles, project.defaultRole, id);
              const online = presence.some((p) => p.userId === id) || id === workspace.userId;
              return (
                <li key={id} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    title={online ? 'Online' : 'Offline'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-700 dark:text-gray-200">
                      {name}
                      {id === workspace.userId && <span className="text-gray-400 dark:text-gray-500"> (you)</span>}
                    </span>
                    <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{id}</span>
                  </span>
                  <select
                    value={explicit ?? ''}
                    disabled={!isAdmin}
                    onChange={(e) => setProjectRole(project.id, id, (e.target.value || null) as Role | null)}
                    title={ROLES.find((r) => r.value === effective)?.description}
                    className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm outline-none disabled:opacity-60"
                  >
                    <option value="">Default ({effective})</option>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>

          {isAdmin && (
            <div className="flex gap-2">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                placeholder="colleague@company.com"
                className="min-w-0 flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                onClick={addPerson}
                className="rounded-md bg-[#4f7cff] px-3 py-1 text-sm font-medium text-white hover:bg-[#3d68f0]"
              >
                Add
              </button>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Access is enforced by Gantic itself: everyone's copy of the app refuses changes from people without the
            right role, and refusals show up in Activity. It isn't a security boundary against someone editing the
            shared folder's files directly.
          </p>
        </div>
      </div>
    </>
  );
}
