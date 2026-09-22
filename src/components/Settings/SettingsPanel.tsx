import { useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import type { ColumnVisibility, Language } from '../../types';
import { formatShortDate } from '../../lib/dates';
import { useT } from '../../lib/i18n';
import { listBackups } from '../../lib/backup';
import { requestNotificationPermission, notificationsSupported } from '../../lib/notifications';

const COLUMN_LABELS: { key: keyof ColumnVisibility; label: string }[] = [
  { key: 'start', label: 'Start date' },
  { key: 'end', label: 'End date' },
  { key: 'duration', label: 'Duration' },
  { key: 'progress', label: 'Progress' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
];

export function SettingsPanel() {
  const settingsOpen = useGanticStore((s) => s.settingsOpen);
  const setSettingsOpen = useGanticStore((s) => s.setSettingsOpen);
  const visibleColumns = useGanticStore((s) => s.visibleColumns);
  const toggleColumn = useGanticStore((s) => s.toggleColumn);
  const activeProject = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const addHoliday = useGanticStore((s) => s.addHoliday);
  const removeHoliday = useGanticStore((s) => s.removeHoliday);
  const addCustomFieldDef = useGanticStore((s) => s.addCustomFieldDef);
  const removeCustomFieldDef = useGanticStore((s) => s.removeCustomFieldDef);
  const toggleUseWorkingDays = useGanticStore((s) => s.toggleUseWorkingDays);
  const language = useGanticStore((s) => s.language);
  const setLanguage = useGanticStore((s) => s.setLanguage);
  const notificationsEnabled = useGanticStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useGanticStore((s) => s.setNotificationsEnabled);
  const restoreProjectsAndTasks = useGanticStore((s) => s.restoreProjectsAndTasks);
  const t = useT();

  const [newHoliday, setNewHoliday] = useState('');
  const [newField, setNewField] = useState('');

  if (!settingsOpen) return null;

  async function handleToggleNotifications() {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
    } else {
      setNotificationsEnabled(false);
    }
  }

  function handleRestoreBackup(timestamp: number) {
    const backup = listBackups().find((b) => b.timestamp === timestamp);
    if (!backup) return;
    if (confirm('Restore this backup? Current data will be replaced (you can still Undo).')) {
      restoreProjectsAndTasks(backup.projects, backup.tasks);
      setSettingsOpen(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSettingsOpen(false)} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">{t('settings')}</h2>
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
              {t('language')}
            </h3>
            <div className="flex gap-1.5 rounded-md border border-gray-200 p-0.5" style={{ width: 'fit-content' }}>
              {(['en', 'fr'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={
                    language === lang
                      ? 'rounded bg-[#4f7cff] px-3 py-1 text-sm font-medium text-white'
                      : 'rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100'
                  }
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          {notificationsSupported() && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Notifications
              </h3>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={handleToggleNotifications}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-[#4f7cff] focus:ring-[#4f7cff]"
                />
                Notify me about overdue and due-today tasks
              </label>
            </section>
          )}

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('tableColumns')}
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
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Custom fields — {activeProject.name}
              </h3>
              <p className="mb-3 text-xs text-gray-400">
                Extra per-task columns, e.g. "Cost" or "Ticket #".
              </p>
              {activeProject.customFieldDefs.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {activeProject.customFieldDefs.map((field) => (
                    <li
                      key={field}
                      className="group flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {field}
                      <button
                        onClick={() => removeCustomFieldDef(activeProject.id, field)}
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
                  value={newField}
                  onChange={(e) => setNewField(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newField.trim()) {
                      addCustomFieldDef(activeProject.id, newField);
                      setNewField('');
                    }
                  }}
                  placeholder="Field name…"
                  className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
                />
                <button
                  onClick={() => {
                    if (newField.trim()) {
                      addCustomFieldDef(activeProject.id, newField);
                      setNewField('');
                    }
                  }}
                  className="rounded-md bg-[#4f7cff] px-2.5 py-1 text-sm font-medium text-white hover:bg-[#3d68f0]"
                >
                  Add
                </button>
              </div>
            </section>
          )}

          {activeProject && (
            <section className="mb-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={activeProject.useWorkingDays}
                  onChange={() => toggleUseWorkingDays(activeProject.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-[#4f7cff] focus:ring-[#4f7cff]"
                />
                Duration counts working days only (skip weekends &amp; holidays) — {activeProject.name}
              </label>
            </section>
          )}

          {activeProject && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t('nonWorkingDays')} — {activeProject.name}
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

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Local backups
            </h3>
            <p className="mb-3 text-xs text-gray-400">
              Gantic snapshots your data automatically every few minutes so you can roll back a bad edit.
            </p>
            {listBackups().length === 0 ? (
              <p className="text-sm text-gray-400">No backups yet.</p>
            ) : (
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {listBackups().map((b) => (
                  <li
                    key={b.timestamp}
                    className="flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {new Date(b.timestamp).toLocaleString()}
                    <button
                      onClick={() => handleRestoreBackup(b.timestamp)}
                      className="rounded border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
