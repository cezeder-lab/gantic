import type { Task } from '../types';

/**
 * Simplified critical path: the chain of dependency-linked tasks with zero
 * slack (predecessor.end === successor.start) that ends at whichever task(s)
 * currently finish the project latest. This isn't full CPM with float
 * calculation (dates here are fixed by the user, not derived from durations),
 * but it highlights the tightest chain that determines the project's end date.
 */
export function computeCriticalPath(tasks: Task[], projectId: string): Set<string> {
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const leafTasks = projectTasks.filter((t) => !projectTasks.some((other) => other.parentId === t.id));
  if (leafTasks.length === 0) return new Set();

  const maxEnd = leafTasks.reduce((max, t) => (t.end > max ? t.end : max), leafTasks[0].end);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const critical = new Set<string>();
  const queue: string[] = leafTasks.filter((t) => t.end === maxEnd).map((t) => t.id);
  for (const id of queue) critical.add(id);

  while (queue.length) {
    const id = queue.shift()!;
    const task = byId.get(id);
    if (!task) continue;
    for (const depId of task.dependencies) {
      const dep = byId.get(depId);
      if (!dep || critical.has(depId)) continue;
      if (dep.end === task.start) {
        critical.add(depId);
        queue.push(depId);
      }
    }
  }

  return critical;
}
