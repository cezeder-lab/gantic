import { useEffect, useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import type { ColumnVisibility } from '../../types';
import { formatShortDate } from '../../lib/dates';
import { listBackups } from '../../lib/backup';
import { requestNotificationPermission, notificationsSupported } from '../../lib/notifications';
import { getElectronAPI } from '../../lib/electronBridge';
import { WorkspaceSettings } from '../Workspace/WorkspaceSettings';
import { useCanEdit } from '../../lib/sync/useProjectRole';

const UPDATE_STATUS_LABEL: Record<string, string> = {
  checking: 'Checking for updates…',
  available: 'Update found, downloading…',
  'not-available': "You're up to date.",
  downloading: 'Downloading update…',
  downloaded: 'Update downloaded — restart to install.',
  error: 'Could not check for updates.',
};

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
  const darkMode = useGanticStore((s) => s.darkMode);
  const toggleDarkMode = useGanticStore((s) => s.toggleDarkMode);
  const setHelpOpen = useGanticStore((s) => s.setHelpOpen);
  const updateStatus = useGanticStore((s) => s.updateStatus);
  const setUpdateStatus = useGanticStore((s) => s.setUpdateStatus);
  const notificationsEnabled = useGanticStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useGanticStore((s) => s.setNotificationsEnabled);
  const restoreProjectsAndTasks = useGanticStore((s) => s.restoreProjectsAndTasks);
  const workspace = useGanticStore((s) => s.workspace);
  const canEditProject = useCanEdit(activeProject?.id);
  const displayName = useGanticStore((s) => s.displayName);
  const setDisplayName = useGanticStore((s) => s.setDisplayName);

  const [newHoliday, setNewHoliday] = useState('');
  const [newField, setNewField] = useState('');
  const [dataFolder, setDataFolder] = useState<string | null>(null);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const electronAPI = getElectronAPI();

  useEffect(() => {
    if (settingsOpen && electronAPI) {
      electronAPI.getDataFolder().then(setDataFolder);
      electronAPI.getAppVersion().then(setAppVersion);
    }
  }, [settingsOpen, electronAPI]);

  if (!settingsOpen) return null;

  async function handleChooseDataFolder() {
    if (!electronAPI) return;
    setChoosingFolder(true);
    try {
      const chosen = await electronAPI.chooseDataFolder();
      if (chosen) {
        // The main process already copied existing data into the new folder —
        // reload so the store rehydrates from it instead of the old one.
        window.location.reload();
      }
    } finally {
      setChoosingFolder(false);
    }
  }

  async function handleCheckForUpdates() {
    if (!electronAPI) return;
    setCheckingUpdate(true);
    setUpdateStatus({ status: 'checking' });
    try {
      const result = await electronAPI.checkForUpdates();
      if (result.skipped) {
        setUpdateStatus({ status: 'error', message: result.reason });
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

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
      <div className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <WorkspaceSettings />

          {electronAPI && !workspace && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Project data folder
              </h3>
              <p className="mb-2 truncate rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300" title={dataFolder ?? ''}>
                {dataFolder ?? '…'}
              </p>
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                Your projects and attachments are saved here. Change folder to store them elsewhere
                (a USB drive, Dropbox, OneDrive…) — existing data is copied over automatically.
              </p>
              <button
                onClick={handleChooseDataFolder}
                disabled={choosingFolder}
                className="rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {choosingFolder ? 'Copying…' : 'Choose folder…'}
              </button>
            </section>
          )}

          {electronAPI && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Software update
              </h3>
              <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
                Version {appVersion ?? '…'}
                {updateStatus && ` — ${UPDATE_STATUS_LABEL[updateStatus.status] ?? updateStatus.status}`}
                {updateStatus?.status === 'downloading' && updateStatus.percent != null && ` (${Math.round(updateStatus.percent)}%)`}
              </p>
              {updateStatus?.status === 'downloaded' ? (
                <button
                  onClick={() => electronAPI.quitAndInstallUpdate()}
                  className="rounded-md bg-[#4f7cff] px-2.5 py-1 text-sm font-medium text-white hover:bg-[#3d68f0]"
                >
                  Restart &amp; install
                </button>
              ) : (
                <button
                  onClick={handleCheckForUpdates}
                  disabled={checkingUpdate}
                  className="rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {checkingUpdate ? 'Checking…' : 'Check for updates'}
                </button>
              )}
            </section>
          )}

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Appearance
            </h3>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={toggleDarkMode}
                className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-[#4f7cff] focus:ring-[#4f7cff]"
              />
              Dark mode
            </label>
            {!workspace && (
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                Your name
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Used in the greeting"
                  className="min-w-0 flex-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
                />
              </label>
            )}
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Help
            </h3>
            <button
              onClick={() => {
                setSettingsOpen(false);
                setHelpOpen(true);
              }}
              className="rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Keyboard shortcuts…
            </button>
          </section>

          {notificationsSupported() && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Notifications
              </h3>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={handleToggleNotifications}
                  className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-[#4f7cff] focus:ring-[#4f7cff]"
                />
                Notify me about overdue and due-today tasks
              </label>
            </section>
          )}

          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Table columns
            </h3>
            <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
              Choose which columns appear in the task table. "Task name" is always shown.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COLUMN_LABELS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => toggleColumn(col.key)}
                    className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-[#4f7cff] focus:ring-[#4f7cff]"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </section>

          {/* Project settings are shared data: read-only for viewers. */}
          <fieldset disabled={!canEditProject} className="disabled:opacity-60">
          {activeProject && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Custom fields — {activeProject.name}
              </h3>
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                Extra per-task columns, e.g. "Cost" or "Ticket #".
              </p>
              {activeProject.customFieldDefs.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {activeProject.customFieldDefs.map((field) => (
                    <li
                      key={field}
                      className="group flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {field}
                      <button
                        onClick={() => removeCustomFieldDef(activeProject.id, field)}
                        className="hidden h-5 w-5 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 group-hover:flex"
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
                  className="min-w-0 flex-1 rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
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
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={activeProject.useWorkingDays}
                  onChange={() => toggleUseWorkingDays(activeProject.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-[#4f7cff] focus:ring-[#4f7cff]"
                />
                Duration counts working days only (skip weekends &amp; holidays) — {activeProject.name}
              </label>
            </section>
          )}

          {activeProject && (
            <section className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Non-working days — {activeProject.name}
              </h3>
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                Dates shaded like weekends in the Gantt timeline (day zoom).
              </p>

              {activeProject.holidays.length > 0 && (
                <ul className="mb-3 max-h-32 space-y-1 overflow-y-auto">
                  {activeProject.holidays.map((date) => (
                    <li
                      key={date}
                      className="group flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {formatShortDate(date)}
                      <button
                        onClick={() => removeHoliday(activeProject.id, date)}
                        className="hidden h-5 w-5 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 group-hover:flex"
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
                  className="min-w-0 flex-1 rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
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
          </fieldset>

          {/* In a team workspace the shared activity log is the history;
              restoring a local snapshot would overwrite everyone's work. */}
          {!workspace && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Local backups
            </h3>
            <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
              Gantic snapshots your data automatically every few minutes so you can roll back a bad edit.
            </p>
            {listBackups().length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No backups yet.</p>
            ) : (
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {listBackups().map((b) => (
                  <li
                    key={b.timestamp}
                    className="flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {new Date(b.timestamp).toLocaleString()}
                    <button
                      onClick={() => handleRestoreBackup(b.timestamp)}
                      className="rounded border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}
        </div>
      </div>
    </>
  );
}
