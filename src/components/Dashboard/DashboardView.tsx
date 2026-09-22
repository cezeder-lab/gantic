import { useMemo } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { diffDays, formatShortDate, todayISO } from '../../lib/dates';
import { TASK_STATUSES } from '../../types';

export function DashboardView() {
  const projects = useGanticStore((s) => s.projects);
  const tasks = useGanticStore((s) => s.tasks);
  const setActiveProject = useGanticStore((s) => s.setActiveProject);
  const setViewMode = useGanticStore((s) => s.setViewMode);
  const setSelectedTask = useGanticStore((s) => s.setSelectedTask);
  const setGlobalSearchOpen = useGanticStore((s) => s.setGlobalSearchOpen);

  const today = todayISO();

  const cards = useMemo(() => {
    return projects
      .map((project) => {
        const projectTasks = tasks.filter((t) => t.projectId === project.id);
        const leafTasks = projectTasks.filter((t) => !projectTasks.some((o) => o.parentId === t.id));
        const open = leafTasks.filter((t) => t.status !== 'done' && !t.isMilestone);
        const overdue = open.filter((t) => t.end < today);
        const upcoming = [...open].sort((a, b) => a.end.localeCompare(b.end)).slice(0, 5);
        const nearestEnd = upcoming[0]?.end ?? null;
        return { project, upcoming, overdueCount: overdue.length, openCount: open.length, nearestEnd };
      })
      .sort((a, b) => {
        if (!a.nearestEnd) return 1;
        if (!b.nearestEnd) return -1;
        return a.nearestEnd.localeCompare(b.nearestEnd);
      });
  }, [projects, tasks, today]);

  function openTask(projectId: string, taskId: string) {
    setActiveProject(projectId);
    setViewMode('project');
    setSelectedTask(taskId);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafbfc] dark:bg-gray-900 px-8 py-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <button
          onClick={() => setGlobalSearchOpen(true)}
          title="Search all projects (Ctrl+K)"
          className="flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          🔍 Search all projects
        </button>
      </div>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Nearest deadlines across all projects.</p>

      {cards.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No projects yet.</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ project, upcoming, overdueCount, openCount }) => (
          <div key={project.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <button
              onClick={() => {
                setActiveProject(project.id);
                setViewMode('project');
              }}
              className="mb-3 flex w-full items-center gap-2 text-left"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <h2 className="min-w-0 flex-1 truncate font-semibold text-gray-800 dark:text-gray-100 hover:underline">
                {project.name}
              </h2>
              {overdueCount > 0 && (
                <span className="shrink-0 rounded-full bg-red-50 dark:bg-red-950 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {overdueCount} overdue
                </span>
              )}
            </button>

            {openCount === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nothing open — all caught up.</p>
            ) : (
              <ul className="space-y-1.5">
                {upcoming.map((task) => {
                  const isOverdue = task.end < today;
                  const days = diffDays(today, task.end);
                  const statusColor = TASK_STATUSES.find((s) => s.value === task.status)?.color;
                  return (
                    <li key={task.id}>
                      <button
                        onClick={() => openTask(project.id, task.id)}
                        className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} />
                        <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">{task.name}</span>
                        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{task.assignee || '—'}</span>
                        <span
                          className={`shrink-0 text-xs font-medium ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}
                        >
                          {isOverdue ? `${formatShortDate(task.end)} · overdue` : `${formatShortDate(task.end)} · ${days}d`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
