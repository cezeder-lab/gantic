import clsx from 'clsx';
import { useGanticStore } from '../store/useGanticStore';
import type { ZoomLevel } from '../types';

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
];

export function Toolbar({ onScrollToday }: { onScrollToday: () => void }) {
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const zoom = useGanticStore((s) => s.zoom);
  const setZoom = useGanticStore((s) => s.setZoom);
  const addTask = useGanticStore((s) => s.addTask);

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
        <button
          onClick={onScrollToday}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Aujourd'hui
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
          + Ajouter une tâche
        </button>
      </div>
    </div>
  );
}
