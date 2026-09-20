import { useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import type { ColumnVisibility } from '../../types';
import { formatShortDate } from '../../lib/dates';

const COLUMN_LABELS: { key: keyof ColumnVisibility; label: string }[] = [
  { key: 'start', label: 'Start date' },
  { key: 'end', label: 'End date' },
  { key: 'duration', label: 'Duration' },
  { key: 'progress', label: 'Progress' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'status', label: 'Status' },
];

export function SettingsPanel() {
  const settingsOpen = useGanticStore((s) => s.settingsOpen);
  const setSettingsOpen = useGanticStore((s) => s.setSettingsOpen);
  const visibleColumns = useGanticStore((s) => s.visibleColumns);
  const toggleColumn = useGanticStore((s) => s.toggleColumn);
  const activeProject = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const addHoliday = useGanticStore((s) => s.addHoliday);
  const removeHoliday = useGanticStore((s) => s.removeHoliday);

  const [newHoliday, setNewHoliday] = useState('');

  if (!settingsOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSettingsOpen(false)} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Table columns
            </h3>
            <p className="mb-3 text-xs text-gray-400">
              Choose which columns appear in the task table. "Task name" is always shown.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COLUMN_LABELS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => toggleColumn(col.key)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-[#4f7cff] focus:ring-[#4f7cff]"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </section>

          {activeProject && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Non-working days — {activeProject.name}
              </h3>
              <p className="mb-3 text-xs text-gray-400">
                Dates shaded like weekends in the Gantt timeline (day zoom).
              </p>

              {activeProject.holidays.length > 0 && (
                <ul className="mb-3 max-h-32 space-y-1 overflow-y-auto">
                  {activeProject.holidays.map((date) => (
                    <li
                      key={date}
                      className="group flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {formatShortDate(date)}
                      <button
                        onClick={() => removeHoliday(activeProject.id, date)}
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
                  type="date"
                  value={newHoliday}
                  onChange={(e) => setNewHoliday(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
                />
                <button
                  onClick={() => {
                    if (newHoliday) {
                      addHoliday(activeProject.id, newHoliday);
                      setNewHoliday('');
                    }
                  }}
                  className="rounded-md bg-[#4f7cff] px-2.5 py-1 text-sm font-medium text-white hover:bg-[#3d68f0]"
                >
                  Add
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
