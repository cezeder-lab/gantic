import clsx from 'clsx';
import { useGanticStore } from '../../store/useGanticStore';
import { useProjectRole } from '../../lib/sync/useProjectRole';

const STATUS: Record<string, { label: string; dot: string }> = {
  connecting: { label: 'Connecting…', dot: 'bg-gray-400' },
  synced: { label: 'Saved', dot: 'bg-green-500' },
  saving: { label: 'Saving…', dot: 'bg-amber-400' },
  offline: { label: 'Offline', dot: 'bg-red-500' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#4f7cff', '#7c5cff', '#2fb380', '#f5a623', '#ef5c6e', '#17b3c9'];
function avatarColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Team-workspace controls shown next to the project title. */
export function WorkspaceBar({ projectId }: { projectId: string }) {
  const workspace = useGanticStore((s) => s.workspace);
  const status = useGanticStore((s) => s.syncStatus);
  const message = useGanticStore((s) => s.syncMessage);
  const presence = useGanticStore((s) => s.presence);
  const setActivityOpen = useGanticStore((s) => s.setActivityOpen);
  const setAccessProjectId = useGanticStore((s) => s.setAccessProjectId);
  const role = useProjectRole(projectId);
  if (!workspace) return null;

  const here = presence.filter((p) => p.projectId === projectId);
  const elsewhere = presence.length - here.length;
  const st = STATUS[status] ?? STATUS.connecting;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {role === 'viewer' && status !== 'connecting' && (
        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          View only
        </span>
      )}

      <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500" title={message ?? st.label}>
        <span className={clsx('h-2 w-2 rounded-full', st.dot)} />
        {st.label}
      </span>

      {here.length > 0 && (
        <div className="flex -space-x-1.5">
          {here.slice(0, 4).map((p) => (
            <span
              key={p.clientId}
              title={`${p.userName} is viewing this project`}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-gray-900 text-[10px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(p.userId) }}
            >
              {initials(p.userName)}
            </span>
          ))}
          {here.length > 4 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-gray-900 bg-gray-400 text-[10px] font-semibold text-white">
              +{here.length - 4}
            </span>
          )}
        </div>
      )}
      {elsewhere > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500" title={presence.filter((p) => p.projectId !== projectId).map((p) => p.userName).join(', ')}>
          +{elsewhere} online
        </span>
      )}

      <button
        onClick={() => setAccessProjectId(projectId)}
        title="Who can view or edit this project"
        className="rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        Share
      </button>
      <button
        onClick={() => setActivityOpen(true)}
        title="History of every change"
        className="rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        Activity
      </button>
    </div>
  );
}
