import { useGanticStore } from '../../store/useGanticStore';
import { TASK_STATUSES, TASK_PRIORITIES } from '../../types';
import type { TaskPriority, TaskStatus } from '../../types';

export function BulkActionBar() {
  const selectedTaskIds = useGanticStore((s) => s.selectedTaskIds);
  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const members = useGanticStore((s) => s.projects.find((p) => p.id === activeProjectId)?.members ?? []);
  const bulkSetAssignee = useGanticStore((s) => s.bulkSetAssignee);
  const bulkSetStatus = useGanticStore((s) => s.bulkSetStatus);
  const bulkSetPriority = useGanticStore((s) => s.bulkSetPriority);
  const bulkDeleteTasks = useGanticStore((s) => s.bulkDeleteTasks);
  const clearSelection = useGanticStore((s) => s.clearSelection);

  if (selectedTaskIds.length < 2) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-xl">
        <span className="text-sm font-medium text-gray-700">{selectedTaskIds.length} selected</span>
        <div className="h-4 w-px bg-gray-200" />

        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value !== '') bulkSetAssignee(selectedTaskIds, e.target.value);
            e.target.value = '';
          }}
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 outline-none focus:border-blue-300"
        >
          <option value="" disabled>
            Set assignee…
          </option>
          <option value="">— Unassigned</option>
          {members.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value !== '') bulkSetStatus(selectedTaskIds, e.target.value as TaskStatus);
            e.target.value = '';
          }}
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 outline-none focus:border-blue-300"
        >
          <option value="" disabled>
            Set status…
          </option>
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value !== '') bulkSetPriority(selectedTaskIds, e.target.value as TaskPriority);
            e.target.value = '';
          }}
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 outline-none focus:border-blue-300"
        >
          <option value="" disabled>
            Set priority…
          </option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            if (confirm(`Delete ${selectedTaskIds.length} selected tasks?`)) {
              bulkDeleteTasks(selectedTaskIds);
            }
          }}
          className="rounded-md border border-red-200 px-2.5 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>

        <button
          onClick={clearSelection}
          title="Clear selection"
          className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
