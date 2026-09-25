import { useMemo, useState, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { useGanticStore } from '../../store/useGanticStore';
import { syncEngine } from '../../lib/sync/engine';
import { describeChange } from '../../lib/sync/describe';
import { stampToDate } from '../../lib/sync/hlc';
import type { Change } from '../../lib/sync/types';

const PAGE = 200;

interface Row {
  key: string;
  when: Date;
  author: string;
  authorId: string;
  projectName: string;
  text: string;
  rejected: boolean;
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function ActivityPanel() {
  const open = useGanticStore((s) => s.activityOpen);
  const setOpen = useGanticStore((s) => s.setActivityOpen);
  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const workspaceName = useGanticStore((s) => s.workspaceName);
  const version = useSyncExternalStore(syncEngine.subscribeActivity, syncEngine.getActivityVersion);
  const [scope, setScope] = useState<'project' | 'all'>('project');
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo<Row[]>(() => {
    if (!open) return [];
    const users = syncEngine.knownUsers();
    const userName = (id: string) => users.get(id) ?? id;
    const out: Row[] = [];
    for (const { commit, rejected } of syncEngine.getActivity()) {
      const rejectedSet = new Set<Change>(rejected ?? []);
      commit.changes.forEach((ch, i) => {
        if (scope === 'project' && ch.p !== activeProjectId) return;
        const projectName = syncEngine.lookupName('project', ch.p) ?? '(deleted project)';
        describeChange(ch, syncEngine.lookupName, userName).forEach((text, j) => {
          out.push({
            key: `${commit.id}-${i}-${j}`,
            when: stampToDate(commit.ts),
            author: commit.author.name,
            authorId: commit.author.id,
            projectName,
            text,
            rejected: rejectedSet.has(ch),
          });
        });
      });
    }
    return out;
    // `version` isn't read, but bumps whenever new log entries arrive.
  }, [open, scope, activeProjectId, version]);

  if (!open) return null;

  function exportCsv() {
    const header = ['Time', 'User', 'User ID', 'Project', 'Change', 'Result'];
    const lines = rows.map((r) =>
      [r.when.toISOString(), r.author, r.authorId, r.projectName, r.text, r.rejected ? 'Refused (no permission)' : 'Applied']
        .map(csvCell)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspaceName ?? 'gantic'}-activity.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Activity</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">Every change made in the team workspace, newest first.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-5 py-2">
          <div className="flex rounded-md border border-gray-200 dark:border-gray-700 p-0.5 text-xs">
            {(['project', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScope(s);
                  setLimit(PAGE);
                }}
                className={clsx(
                  'rounded px-2.5 py-1 font-medium',
                  scope === s ? 'bg-[#4f7cff] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                {s === 'project' ? 'This project' : 'All projects'}
              </button>
            ))}
          </div>
          <span className="flex-1 text-right text-xs text-gray-400 dark:text-gray-500">{rows.length} entries</span>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
          >
            Export .csv
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto px-5 py-3">
          {rows.length === 0 && (
            <li className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No activity yet.</li>
          )}
          {rows.slice(0, limit).map((r) => (
            <li key={r.key} className="border-b border-gray-50 dark:border-gray-800 py-2 last:border-0">
              <div className="flex items-baseline gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span className="font-semibold text-gray-600 dark:text-gray-300" title={r.authorId}>
                  {r.author}
                </span>
                <span>{r.when.toLocaleString()}</span>
                {scope === 'all' && <span className="truncate">· {r.projectName}</span>}
              </div>
              <p
                className={clsx(
                  'text-sm',
                  r.rejected ? 'text-red-600 dark:text-red-400 line-through' : 'text-gray-700 dark:text-gray-200',
                )}
              >
                {r.text}
              </p>
              {r.rejected && (
                <p className="text-xs text-red-600 dark:text-red-400">Refused — this person didn't have permission.</p>
              )}
            </li>
          ))}
          {rows.length > limit && (
            <li className="py-3 text-center">
              <button
                onClick={() => setLimit((l) => l + PAGE)}
                className="text-sm font-medium text-[#4f7cff] hover:underline"
              >
                Show more
              </button>
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
