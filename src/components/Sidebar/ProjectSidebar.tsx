import { useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { PROJECT_COLORS } from '../../types';
import clsx from 'clsx';
import { NewProjectDialog } from './NewProjectDialog';

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

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
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-[#fafbfc]">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#4f7cff] text-sm font-bold text-white">
          G
        </div>
        <span className="text-[15px] font-semibold text-gray-800">Gantic</span>
      </div>

      <div className="px-2 pb-2">
        <button
          onClick={() => setViewMode('dashboard')}
          className={clsx(
            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
            viewMode === 'dashboard' ? 'bg-[#e8edff] font-medium text-[#2f4bd1]' : 'text-gray-700 hover:bg-gray-100',
          )}
        >
          <span className="text-base leading-none">📊</span> Dashboard
        </button>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Projects</span>
        <button
          onClick={() => setNewProjectOpen(true)}
          title="New project"
          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          +
        </button>
      </div>
      {newProjectOpen && <NewProjectDialog onClose={() => setNewProjectOpen(false)} />}

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {projects.map((p) => {
          const isActive = viewMode === 'project' && p.id === activeProjectId;
          return (
            <div
              key={p.id}
              className={clsx(
                'group relative mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer',
                isActive ? 'bg-[#e8edff] text-[#2f4bd1] font-medium' : 'text-gray-700 hover:bg-gray-100',
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
                  className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-1 py-0.5 text-sm outline-none"
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
                className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 group-hover:flex"
              >
                ⋯
              </button>

              {menuId === p.id && (
                <div
                  className="absolute right-1 top-9 z-20 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    onClick={() => startEdit(p.id, p.name)}
                  >
                    Rename
                  </button>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    onClick={() => {
                      duplicateProject(p.id);
                      setMenuId(null);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    onClick={() => {
                      const name = prompt('Template name:', p.name);
                      if (name) saveAsTemplate(p.id, name);
                      setMenuId(null);
                    }}
                  >
                    Save as template
                  </button>
                  <div className="my-1 border-t border-gray-100" />
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
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
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

        {projects.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-gray-400">No projects yet. Create one!</p>
        )}
      </div>
    </div>
  );
}
