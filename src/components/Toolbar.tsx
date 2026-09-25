import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useGanticStore } from '../store/useGanticStore';
import type { TaskSortMode, ZoomLevel } from '../types';
import { exportProjectToJSON, downloadProjectJSON, parseProjectImport } from '../lib/projectIO';
import { parseTasksCsv } from '../lib/csvImport';
import { WorkspaceBar } from './Workspace/WorkspaceBar';
import { useCanEdit } from '../lib/sync/useProjectRole';

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const SORT_OPTIONS: { value: TaskSortMode; label: string }[] = [
  { value: 'manual', label: 'Original order' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'assignee', label: 'Assignee' },
];

export function Toolbar({
  onScrollToday,
  onExportImage,
  onFitToScreen,
}: {
  onScrollToday: () => void;
  onExportImage: () => void;
  onFitToScreen: () => void;
}) {
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const tasks = useGanticStore((s) => s.tasks);
  const zoom = useGanticStore((s) => s.zoom);
  const setZoom = useGanticStore((s) => s.setZoom);
  const addTask = useGanticStore((s) => s.addTask);
  const taskSort = useGanticStore((s) => s.taskSort);
  const setTaskSort = useGanticStore((s) => s.setTaskSort);
  const taskFilterQuery = useGanticStore((s) => s.taskFilterQuery);
  const setTaskFilterQuery = useGanticStore((s) => s.setTaskFilterQuery);
  const showCriticalPath = useGanticStore((s) => s.showCriticalPath);
  const toggleCriticalPath = useGanticStore((s) => s.toggleCriticalPath);
  const setSettingsOpen = useGanticStore((s) => s.setSettingsOpen);
  const past = useGanticStore((s) => s.past);
  const future = useGanticStore((s) => s.future);
  const undo = useGanticStore((s) => s.undo);
  const redo = useGanticStore((s) => s.redo);
  const importProject = useGanticStore((s) => s.importProject);
  const compactView = useGanticStore((s) => s.compactView);
  const toggleCompactView = useGanticStore((s) => s.toggleCompactView);
  const notesPanelOpen = useGanticStore((s) => s.notesPanelOpen);
  const toggleNotesPanel = useGanticStore((s) => s.toggleNotesPanel);

  const canEdit = useCanEdit(project?.id);
  const [teamOpen, setTeamOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function handleExportJSON() {
    if (!project) return;
    const json = await exportProjectToJSON(
      project,
      tasks.filter((t) => t.projectId === project.id),
    );
    downloadProjectJSON(project, json);
    setActionsOpen(false);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const { project: importedProject, tasks: importedTasks } = await parseProjectImport(text);
      importProject(importedProject, importedTasks);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not import this file.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
      setActionsOpen(false);
    }
  }

  async function handleImportCsv(file: File) {
    try {
      const text = await file.text();
      const { project: importedProject, tasks: importedTasks } = parseTasksCsv(
        text,
        file.name.replace(/\.csv$/i, ''),
      );
      importProject(importedProject, importedTasks);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not import this CSV file.');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
      setActionsOpen(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2">
          {project && (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <h1 className="truncate text-base font-semibold text-gray-800 dark:text-gray-100">{project.name}</h1>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <IconBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={past.length === 0}>
            ↶
          </IconBtn>
          <IconBtn title="Redo (Ctrl+Y)" onClick={redo} disabled={future.length === 0}>
            ↷
          </IconBtn>

          {project && (
            <div className="relative">
              <button
                onClick={() => setTeamOpen((v) => !v)}
                className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Team {project.members.length > 0 && `(${project.members.length})`}
              </button>
              {teamOpen && (
                <TeamPopover projectId={project.id} members={project.members} onClose={() => setTeamOpen(false)} />
              )}
            </div>
          )}

          {project && (
            <button
              onClick={toggleNotesPanel}
              title="Open the notes panel, dockable and resizable at the bottom"
              className={clsx(
                'rounded-md border px-3 py-1.5 text-sm font-medium',
                notesPanelOpen
                  ? 'border-[#4f7cff] bg-[#eef2ff] text-[#4f7cff] dark:bg-[#1e2a4a]'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              Notes
            </button>
          )}

          <button
            onClick={onScrollToday}
            className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Today
          </button>

          <div className="flex rounded-md border border-gray-200 dark:border-gray-700 p-0.5">
            {ZOOM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setZoom(opt.value)}
                className={clsx(
                  'rounded px-3 py-1 text-sm font-medium transition-colors',
                  zoom === opt.value ? 'bg-[#4f7cff] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={onFitToScreen}
            title="Fit whole project to the visible width"
            className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            ⤢ Fit
          </button>

          <button
            onClick={toggleCompactView}
            title="Toggle compact row height"
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-md border text-sm',
              compactView ? 'border-[#4f7cff] bg-[#eef2ff] text-[#4f7cff] dark:bg-[#1e2a4a]' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
            )}
          >
            ☰
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            ⚙
          </button>

          <div className="relative">
            <button
              onClick={() => setActionsOpen((v) => !v)}
              className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Export ▾
            </button>
            {actionsOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setActionsOpen(false)} />
                <div className="absolute right-0 top-10 z-30 w-52 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setActionsOpen(false);
                      onExportImage();
                    }}
                    disabled={!project}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    Export as PNG image
                  </button>
                  <button
                    onClick={() => {
                      setActionsOpen(false);
                      window.print();
                    }}
                    disabled={!project}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    Print / Save as PDF
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                  <button
                    onClick={handleExportJSON}
                    disabled={!project}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    Export project (.json)
                  </button>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Import project (.json)
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
                  />
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Import tasks (.csv)
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept="text/csv,.csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImportCsv(e.target.files[0])}
                  />
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => addTask({ parentId: null })}
            disabled={!project || !canEdit}
            className="rounded-md bg-[#4f7cff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#3d68f0] disabled:opacity-40"
          >
            + Add task
          </button>
        </div>
      </div>

      {project && (
        <div className="flex h-11 items-center gap-2 border-t border-gray-100 dark:border-gray-800 px-4">
          <input
            value={taskFilterQuery}
            onChange={(e) => setTaskFilterQuery(e.target.value)}
            placeholder="Search tasks or assignees…"
            className="w-56 rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
          />

          <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            Sort by
            <select
              value={taskSort}
              onChange={(e) => setTaskSort(e.target.value as TaskSortMode)}
              className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={toggleCriticalPath}
            className={clsx(
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium',
              showCriticalPath
                ? 'border-[#ef5c6e] bg-[#fdecee] text-[#ef5c6e] dark:bg-[#3a1e22]'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
            )}
          >
            <span className="h-2 w-2 rounded-full border-2 border-current" />
            Critical path
          </button>

          <div className="ml-auto">
            <WorkspaceBar projectId={project.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-base text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30"
    >
      {children}
    </button>
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
        className="absolute right-0 top-10 z-30 w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Team members
        </h3>

        {members.length === 0 ? (
          <p className="mb-2 text-sm text-gray-400 dark:text-gray-500">No members yet</p>
        ) : (
          <ul className="mb-2 max-h-48 space-y-1 overflow-y-auto">
            {members.map((m) => (
              <li
                key={m}
                className="group flex items-center justify-between rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {m}
                <button
                  onClick={() => removeProjectMember(projectId, m)}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add a name…"
            className="min-w-0 flex-1 rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
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
