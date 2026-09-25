import type { Project, Task } from '../../types';
import type { Change, EntityType } from './types';
import { sameValue } from './doc';
import type { Snapshot } from './doc';

export interface DraftChange {
  change: Change;
  /** Every synced field of the entity as it is now — used when the entity is
   * new to the log even though the store already had it (e.g. a project's
   * placeholder notes tab that someone just started typing in). */
  all: Record<string, unknown>;
}

// Per-person view state that shouldn't be pushed onto everyone else.
const LOCAL_ONLY_PROJECT_FIELDS = new Set(['id', 'pinned', 'noteTabs']);
const LOCAL_ONLY_TASK_FIELDS = new Set(['id', 'collapsed']);

function projectFields(p: Project): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!LOCAL_ONLY_PROJECT_FIELDS.has(k) && v !== undefined) out[k] = v;
  return out;
}

function taskFields(t: Task): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t)) if (!LOCAL_ONLY_TASK_FIELDS.has(k) && v !== undefined) out[k] = v;
  return out;
}

interface FlatTab {
  id: string;
  projectId: string;
  fields: Record<string, unknown>;
}

function flattenTabs(projects: Project[]): FlatTab[] {
  return projects.flatMap((p) =>
    p.noteTabs.map((tab, order) => ({
      id: tab.id,
      projectId: p.id,
      fields: { projectId: p.id, title: tab.title, content: tab.content, color: tab.color, order },
    })),
  );
}

function diffList<T extends { id: string }>(
  e: EntityType,
  prev: T[],
  next: T[],
  fieldsOf: (x: T) => Record<string, unknown>,
  projectOf: (x: T) => string,
  out: DraftChange[],
  skipDeleteIn: Set<string>,
) {
  const prevById = new Map(prev.map((x) => [x.id, x]));
  const nextIds = new Set<string>();
  for (const n of next) {
    nextIds.add(n.id);
    const o = prevById.get(n.id);
    if (o === n) continue;
    const nf = fieldsOf(n);
    if (!o) {
      out.push({ change: { e, id: n.id, p: projectOf(n), f: { ...nf, _deleted: false } }, all: nf });
      continue;
    }
    const of = fieldsOf(o);
    const f: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(of), ...Object.keys(nf)])) {
      if (!sameValue(of[k], nf[k])) {
        f[k] = nf[k] ?? null;
        before[k] = of[k] ?? null;
      }
    }
    if (Object.keys(f).length > 0) out.push({ change: { e, id: n.id, p: projectOf(n), f, prev: before }, all: nf });
  }
  for (const o of prev) {
    if (nextIds.has(o.id) || skipDeleteIn.has(projectOf(o))) continue;
    out.push({
      change: { e, id: o.id, p: projectOf(o), f: { _deleted: true }, prev: { _deleted: false } },
      all: fieldsOf(o),
    });
  }
}

/** Field-level changes between two store snapshots, projects first so a new
 * project is always created before the tasks that belong to it. */
export function diffSnapshots(prev: Snapshot, next: Snapshot): DraftChange[] {
  const out: DraftChange[] = [];
  const nextProjectIds = new Set(next.projects.map((p) => p.id));
  // When a whole project goes, one "deleted project" entry says it all.
  const deletedProjects = new Set(prev.projects.filter((p) => !nextProjectIds.has(p.id)).map((p) => p.id));

  if (prev.projects !== next.projects) {
    diffList('project', prev.projects, next.projects, projectFields, (p) => p.id, out, new Set());
    const prevTabs = flattenTabs(prev.projects);
    const nextTabs = flattenTabs(next.projects);
    diffList('noteTab', prevTabs, nextTabs, (t) => t.fields, (t) => t.projectId, out, deletedProjects);
  }
  if (prev.tasks !== next.tasks) {
    diffList('task', prev.tasks, next.tasks, taskFields, (t) => t.projectId, out, deletedProjects);
  }
  return out;
}
