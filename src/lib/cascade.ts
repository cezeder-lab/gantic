import type { Task } from '../types';
import { addDays, diffDays } from './dates';

/**
 * When a task's dates change, push forward any task that depends on it (and
 * transitively, tasks that depend on those) so it never starts before its
 * predecessor ends. Keeps each shifted task's own duration unchanged. Guards
 * against cycles via the visited set (BFS only ever enqueues an id once).
 */
export function cascadeDependents(tasks: Task[], changedTaskId: string): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const overrides = new Map<string, Task>();
  const visited = new Set<string>([changedTaskId]);
  const queue: string[] = [changedTaskId];

  while (queue.length) {
    const id = queue.shift()!;
    const current = overrides.get(id) ?? byId.get(id);
    if (!current) continue;

    for (const t of tasks) {
      if (!t.dependencies.includes(id) || visited.has(t.id)) continue;
      const dependent = overrides.get(t.id) ?? t;
      if (dependent.start < current.end) {
        const duration = diffDays(dependent.start, dependent.end);
        const newStart = current.end;
        overrides.set(t.id, { ...dependent, start: newStart, end: addDays(newStart, duration) });
        visited.add(t.id);
        queue.push(t.id);
      }
    }
  }

  if (overrides.size === 0) return tasks;
  return tasks.map((t) => overrides.get(t.id) ?? t);
}
