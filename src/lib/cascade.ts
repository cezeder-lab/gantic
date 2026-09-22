import type { Task } from '../types';
import { addDays, diffDays } from './dates';

/**
 * When a task's dates change, push forward any task that depends on it (and
 * transitively, tasks that depend on those) so the dependency constraint
 * implied by its link type keeps holding:
 *   - FS (finish-to-start, default): successor.start >= predecessor.end
 *   - SS (start-to-start): successor.start >= predecessor.start
 *   - FF (finish-to-finish): successor.end >= predecessor.end
 * Keeps each shifted task's own duration unchanged. Guards against cycles via
 * the visited set (BFS only ever enqueues an id once). Locked tasks are never
 * shifted.
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
      if (!t.dependencies.includes(id) || visited.has(t.id) || t.locked) continue;
      const dependent = overrides.get(t.id) ?? t;
      const type = t.dependencyTypes?.[id] ?? 'FS';
      const duration = diffDays(dependent.start, dependent.end);

      let next: Task | null = null;
      if (type === 'SS') {
        if (dependent.start < current.start) {
          next = { ...dependent, start: current.start, end: addDays(current.start, duration) };
        }
      } else if (type === 'FF') {
        if (dependent.end < current.end) {
          const newStart = addDays(current.end, -duration);
          next = { ...dependent, start: newStart, end: current.end };
        }
      } else if (dependent.start < current.end) {
        next = { ...dependent, start: current.end, end: addDays(current.end, duration) };
      }

      if (next) {
        overrides.set(t.id, next);
        visited.add(t.id);
        queue.push(t.id);
      }
    }
  }

  if (overrides.size === 0) return tasks;
  return tasks.map((t) => overrides.get(t.id) ?? t);
}
