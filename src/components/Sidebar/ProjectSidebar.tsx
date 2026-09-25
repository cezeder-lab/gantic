import { useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { PROJECT_COLORS } from '../../types';
import clsx from 'clsx';
import { NewProjectDialog } from './NewProjectDialog';
import { Greeting } from '../Greeting';

export function ProjectSidebar() {
  const projects = useGanticStore((s) => s.projects);
  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const viewMode = useGanticStore((s) => s.viewMode);
  const setViewMode = useGanticStore((s) => s.setViewMode);
  const setActiveProject = useGanticStore((s) => s.setActiveProject);
  const renameProject = useGanticStore((s) => s.renameProject);
  const deleteProject = useGanticStore((s) => s.deleteProject);
  const duplicateProject = useGanticStore((s) => s.duplicateProject);
  const setProjectColor = useGanticStore((s) => s.setProjectColor);
  const saveAsTemplate = useGanticStore((s) => s.saveAsTemplate);
  const togglePinProject = useGanticStore((s) => s.togglePinProject);
  const toggleArchiveProject = useGanticStore((s) => s.toggleArchiveProject);
  const showArchived = useGanticStore((s) => s.showArchived);
  const toggleShowArchived = useGanticStore((s) => s.toggleShowArchived);
  const workspaceName = useGanticStore((s) => (s.workspace ? (s.workspaceName ?? 'Team workspace') : null));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const visibleProjects = [...projects]
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
    setMenuId(null);
  };

  const commitEdit = () => {
    if (editingId) renameProject(editingId, editValue);
    setEditingId(null);
  };

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 bg-[#fafbfc] dark:bg-gray-900">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#4f7cff] text-sm font-bold text-white">
          G
        </div>
        <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">Gantic</span>
      </div>
      {workspaceName && (
        <p className="-mt-2 mb-2 truncate px-4 text-xs text-gray-400 dark:text-gray-500" title="Team workspace">
          👥 {workspaceName}
        </p>
      )}

      <div className="px-2 pb-2">
        <button
          onClick={() => setViewMode('dashboard')}
          className={clsx(
            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
            viewMode === 'dashboard' ? 'bg-[#e8edff] font-medium text-[#2f4bd1] dark:bg-[#1c2a52] dark:text-[#9db4ff]' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
          )}
        >
          <span className="text-base leading-none">📊</span> Dashboard
        </button>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Projects</span>
        <button
          onClick={() => setNewProjectOpen(true)}
          title="New project"
          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
        >
          +
        </button>
      </div>
      {newProjectOpen && <NewProjectDialog onClose={() => setNewProjectOpen(false)} />}

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {visibleProjects.map((p) => {
          const isActive = viewMode === 'project' && p.id === activeProjectId;
          return (
            <div
              key={p.id}
              className={clsx(
                'group relative mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer',
                isActive ? 'bg-[#e8edff] text-[#2f4bd1] font-medium dark:bg-[#1c2a52] dark:text-[#9db4ff]' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                p.archived && 'opacity-50',
              )}
              onClick={() => {
                setActiveProject(p.id);
                setViewMode('project');
              }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.pinned && (
                <span className="shrink-0 text-[10px]" title="Pin">
                  📌
                </span>
              )}
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 rounded border border-blue-300 bg-white dark:bg-gray-800 px-1 py-0.5 text-sm outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate" onDoubleClick={() => startEdit(p.id, p.name)}>
                  {p.name}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuId(menuId === p.id ? null : p.id);
                }}
                className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 group-hover:flex"
              >
                ⋯
              </button>

              {menuId === p.id && (
                <div
                  className="absolute right-1 top-9 z-20 w-44 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => startEdit(p.id, p.name)}
                  >
                    Rename
                  </button>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => {
                      duplicateProject(p.id);
                      setMenuId(null);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => {
                      const name = prompt('Template name:', p.name);
                      if (name) saveAsTemplate(p.id, name);
                      setMenuId(null);
                    }}
                  >
                    Save as template
                  </button>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => {
                      togglePinProject(p.id);
                      setMenuId(null);
                    }}
                  >
                    {p.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => {
                      toggleArchiveProject(p.id);
                      setMenuId(null);
                    }}
                  >
                    {p.archived ? 'Unarchive' : 'Archive'}
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        className={clsx(
                          'h-4 w-4 rounded-full border-2',
                          p.color === c ? 'border-gray-500' : 'border-transparent',
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => setProjectColor(p.id, c)}
                      />
                    ))}
                  </div>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => {
                      if (confirm(`Delete project "${p.name}"?`)) deleteProject(p.id);
                      setMenuId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {visibleProjects.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-gray-400 dark:text-gray-500">No projects yet. Create one!</p>
        )}
      </div>

      {projects.some((p) => p.archived) && (
        <label className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={toggleShowArchived}
            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-[#4f7cff] focus:ring-[#4f7cff]"
          />
          Show archived
        </label>
      )}

      <div className="border-t border-gray-100 dark:border-gray-800">
        <Greeting />
      </div>
    </div>
  );
}
