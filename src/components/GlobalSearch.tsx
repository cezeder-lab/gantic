import { useMemo, useState } from 'react';
import { useGanticStore } from '../store/useGanticStore';

export function GlobalSearch() {
  const globalSearchOpen = useGanticStore((s) => s.globalSearchOpen);
  const setGlobalSearchOpen = useGanticStore((s) => s.setGlobalSearchOpen);
  const projects = useGanticStore((s) => s.projects);
  const tasks = useGanticStore((s) => s.tasks);
  const setActiveProject = useGanticStore((s) => s.setActiveProject);
  const setViewMode = useGanticStore((s) => s.setViewMode);
  const openTaskDetails = useGanticStore((s) => s.openTaskDetails);

  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const projectById = new Map(projects.map((p) => [p.id, p]));
    return tasks
      .filter((t) => t.name.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q))
      .slice(0, 40)
      .map((t) => ({ task: t, project: projectById.get(t.projectId) }))
      .filter((r) => !!r.project);
  }, [query, tasks, projects]);

  if (!globalSearchOpen) return null;

  function goTo(projectId: string, taskId: string) {
    setActiveProject(projectId);
    setViewMode('project');
    openTaskDetails(taskId);
    setGlobalSearchOpen(false);
    setQuery('');
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setGlobalSearchOpen(false)} />
      <div className="fixed left-1/2 top-24 z-50 w-[520px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white shadow-2xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setGlobalSearchOpen(false)}
          placeholder="Search all projects…"
          className="w-full border-b border-gray-100 px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {query.trim() && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No tasks match "{query}"</p>
          )}
          {results.map(({ task, project }) => (
            <button
              key={task.id}
              onClick={() => goTo(project!.id, task.id)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-gray-50"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.color }} />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{task.name}</span>
              <span className="shrink-0 text-xs text-gray-400">{project!.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
