import type { Task, TaskSortMode } from '../types';

export interface FlatTask {
  task: Task;
  depth: number;
  hasChildren: boolean;
}

function childrenOf(tasks: Task[], parentId: string | null, projectId: string): Task[] {
  return tasks
    .filter((t) => t.projectId === projectId && t.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

function sortSiblings(siblings: Task[], sortMode: TaskSortMode): Task[] {
  if (sortMode === 'manual') return siblings;
  return [...siblings].sort((a, b) => a.end.localeCompare(b.end) || a.order - b.order);
}

/** Depth-first flattened list of ALL tasks in a project, ignoring collapse state. */
export function flattenAll(tasks: Task[], projectId: string, sortMode: TaskSortMode = 'manual'): FlatTask[] {
  const result: FlatTask[] = [];
  const visit = (parentId: string | null, depth: number) => {
    const kids = sortSiblings(childrenOf(tasks, parentId, projectId), sortMode);
    for (const k of kids) {
      const hasChildren = childrenOf(tasks, k.id, projectId).length > 0;
      result.push({ task: k, depth, hasChildren });
      visit(k.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

/** Depth-first flattened list, skipping descendants of collapsed tasks. */
export function flattenVisible(tasks: Task[], projectId: string, sortMode: TaskSortMode = 'manual'): FlatTask[] {
  const all = flattenAll(tasks, projectId, sortMode);
  const collapsedIds = new Set(all.filter((f) => f.task.collapsed).map((f) => f.task.id));
  if (collapsedIds.size === 0) return all;

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const isHiddenByAncestor = (task: Task): boolean => {
    let p = task.parentId;
    while (p) {
      if (collapsedIds.has(p)) return true;
      p = byId.get(p)?.parentId ?? null;
    }
    return false;
  };
  return all.filter((f) => !isHiddenByAncestor(f.task));
}

/**
 * Filters a flattened, already-ordered task list by a search query (name or
 * assignee, case-insensitive substring). A task is kept if it matches, if any
 * ancestor matches (keeps context), or if any descendant matches (so a phase
 * whose child matches stays visible).
 */
export function filterFlatTasks(flat: FlatTask[], query: string): FlatTask[] {
  const q = query.trim().toLowerCase();
  if (!q) return flat;

  const matches = (t: Task) => t.name.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q);
  const byId = new Map(flat.map((f) => [f.task.id, f]));

  const matchesSelfOrAncestor = (f: FlatTask): boolean => {
    if (matches(f.task)) return true;
    let parentId = f.task.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      if (matches(parent.task)) return true;
      parentId = parent.task.parentId;
    }
    return false;
  };

  const idsWithMatchingDescendant = new Set<string>();
  for (const f of flat) {
    if (!matches(f.task)) continue;
    let parentId = f.task.parentId;
    while (parentId) {
      idsWithMatchingDescendant.add(parentId);
      parentId = byId.get(parentId)?.task.parentId ?? null;
    }
  }

  return flat.filter((f) => matchesSelfOrAncestor(f) || idsWithMatchingDescendant.has(f.task.id));
}

export function getDescendantIds(tasks: Task[], taskId: string): string[] {
  const result: string[] = [];
  const visit = (id: string) => {
    for (const t of tasks) {
      if (t.parentId === id) {
        result.push(t.id);
        visit(t.id);
      }
    }
  };
  visit(taskId);
  return result;
}

export function nextOrder(tasks: Task[], projectId: string, parentId: string | null): number {
  const siblings = childrenOf(tasks, parentId, projectId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((s) => s.order)) + 1;
}

export function siblingsOf(tasks: Task[], task: Task): Task[] {
  return childrenOf(tasks, task.parentId, task.projectId);
}

/** Rolled-up date range covering a task and all its descendants. */
export function subtreeRange(tasks: Task[], taskId: string): { start: string; end: string } | null {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const ids = [taskId, ...getDescendantIds(tasks, taskId)];
  const relevant = tasks.filter((t) => ids.includes(t.id));
  let start = relevant[0].start;
  let end = relevant[0].end;
  for (const t of relevant) {
    if (t.start < start) start = t.start;
    if (t.end > end) end = t.end;
  }
  return { start, end };
}
