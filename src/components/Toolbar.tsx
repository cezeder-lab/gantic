import { useState } from 'react';
import clsx from 'clsx';
import { useGanticStore } from '../store/useGanticStore';
import type { ZoomLevel } from '../types';

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function Toolbar({ onScrollToday }: { onScrollToday: () => void }) {
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const zoom = useGanticStore((s) => s.zoom);
  const setZoom = useGanticStore((s) => s.setZoom);
  const addTask = useGanticStore((s) => s.addTask);
  const [teamOpen, setTeamOpen] = useState(false);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-2 min-w-0">
        {project && (
          <>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
            <h1 className="truncate text-base font-semibold text-gray-800">{project.name}</h1>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {project && (
          <div className="relative">
            <button
              onClick={() => setTeamOpen((v) => !v)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Team {project.members.length > 0 && `(${project.members.length})`}
            </button>
            {teamOpen && <TeamPopover projectId={project.id} members={project.members} onClose={() => setTeamOpen(false)} />}
          </div>
        )}

        <button
          onClick={onScrollToday}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Today
        </button>

        <div className="flex rounded-md border border-gray-200 p-0.5">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setZoom(opt.value)}
              className={clsx(
                'rounded px-3 py-1 text-sm font-medium transition-colors',
                zoom === opt.value ? 'bg-[#4f7cff] text-white' : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => addTask({ parentId: null })}
          disabled={!project}
          className="rounded-md bg-[#4f7cff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#3d68f0] disabled:opacity-40"
        >
          + Add task
        </button>
      </div>
    </div>
  );
}

function TeamPopover({
  projectId,
  members,
  onClose,
}: {
  projectId: string;
  members: string[];
  onClose: () => void;
}) {
  const addProjectMember = useGanticStore((s) => s.addProjectMember);
  const removeProjectMember = useGanticStore((s) => s.removeProjectMember);
  const [name, setName] = useState('');

  const submit = () => {
    if (name.trim()) {
      addProjectMember(projectId, name);
      setName('');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div
        className="absolute right-0 top-10 z-30 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Team members
        </h3>

        {members.length === 0 ? (
          <p className="mb-2 text-sm text-gray-400">No members yet</p>
        ) : (
          <ul className="mb-2 max-h-48 space-y-1 overflow-y-auto">
            {members.map((m) => (
              <li
                key={m}
                className="group flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                {m}
                <button
                  onClick={() => removeProjectMember(projectId, m)}
                  className="hidden h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:flex"
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add a name…"
            className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
          />
          <button
            onClick={submit}
            className="rounded-md bg-[#4f7cff] px-2.5 py-1 text-sm font-medium text-white hover:bg-[#3d68f0]"
          >
            Add
          </button>
        </div>
      </div>
    </>
  );
}
