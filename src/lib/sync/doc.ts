import type { NoteTab, Project, Role, Task } from '../../types';
import { DEFAULT_NOTE_TAB_COLOR, PROJECT_COLORS } from '../../types';
import type { Change, Commit, EntityType } from './types';
import { ADMIN_PROJECT_FIELDS, atLeast, effectiveRole } from './permissions';

interface Register {
  v: unknown;
  ts: string;
}

interface EntityState {
  e: EntityType;
  id: string;
  fields: Record<string, Register>;
}

/** Field values not yet written to the log, layered over the replayed state. */
export type Overlay = Map<string, { e: EntityType; id: string; f: Record<string, unknown> }>;

export interface Snapshot {
  projects: Project[];
  tasks: Task[];
}

export const entityKey = (e: EntityType, id: string) => `${e}:${id}`;

function isValidCommit(c: unknown): c is Commit {
  const x = c as Commit;
  return (
    !!x &&
    x.v === 1 &&
    typeof x.id === 'string' &&
    typeof x.ts === 'string' &&
    !!x.author &&
    typeof x.author.id === 'string' &&
    Array.isArray(x.changes)
  );
}

function isValidChange(ch: Change): boolean {
  return (
    !!ch &&
    (ch.e === 'project' || ch.e === 'task' || ch.e === 'noteTab') &&
    typeof ch.id === 'string' &&
    !!ch.f &&
    typeof ch.f === 'object'
  );
}

/**
 * Replicated state built by replaying every client's commits in clock order.
 * Each entity field is a last-writer-wins register, so edits to different
 * fields (or different tasks) from different people always merge, and every
 * client that has seen the same commits ends up with exactly the same state.
 * Each change is checked against the author's role *as of that point in the
 * log*; changes that fail are kept out of the state and remembered for the
 * activity log.
 */
export class SyncDoc {
  private commits: Commit[] = [];
  private seen = new Set<string>();
  private entities = new Map<string, EntityState>();
  private rejected = new Map<string, Change[]>();
  private lastTs = '';

  /** Adds commits (in any order, duplicates ignored); returns true if any were new. */
  add(incoming: unknown[]): boolean {
    const fresh: Commit[] = [];
    for (const c of incoming) {
      if (!isValidCommit(c) || this.seen.has(c.id)) continue;
      this.seen.add(c.id);
      fresh.push(c);
    }
    if (fresh.length === 0) return false;
    fresh.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

    if (fresh[0].ts > this.lastTs) {
      for (const c of fresh) {
        this.commits.push(c);
        this.apply(c);
      }
    } else {
      // Something arrived out of order (e.g. a teammate's file synced late):
      // replay everything so permission checks and field winners are exactly
      // what they'd be had it arrived on time.
      this.commits = [...this.commits, ...fresh].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
      this.entities.clear();
      this.rejected.clear();
      this.lastTs = '';
      for (const c of this.commits) this.apply(c);
    }
    return true;
  }

  private apply(c: Commit) {
    const rejected: Change[] = [];
    for (const ch of c.changes) {
      if (!isValidChange(ch)) continue;
      const key = entityKey(ch.e, ch.id);
      let ent = this.entities.get(key);
      if (!this.allowed(c.author.id, ch, ent)) {
        rejected.push(ch);
        continue;
      }
      if (!ent) {
        ent = { e: ch.e, id: ch.id, fields: {} };
        this.entities.set(key, ent);
      }
      for (const [field, value] of Object.entries(ch.f)) {
        // Tasks and note tabs never move between projects — that would let an
        // editor of one project smuggle content into another.
        if (field === 'projectId' && ent.fields.projectId && ent.fields.projectId.v !== value) continue;
        const reg = ent.fields[field];
        if (!reg || c.ts > reg.ts) ent.fields[field] = { v: value, ts: c.ts };
      }
    }
    if (rejected.length > 0) this.rejected.set(c.id, rejected);
    this.lastTs = c.ts;
  }

  private allowed(userId: string, ch: Change, ent: EntityState | undefined): boolean {
    if (ch.e === 'project') {
      if (!ent) return true; // anyone in the workspace can start a project
      const needsAdmin = Object.keys(ch.f).some((k) => ADMIN_PROJECT_FIELDS.has(k));
      return atLeast(this.roleOf(userId, ch.id), needsAdmin ? 'admin' : 'editor');
    }
    const projectId = (ent?.fields.projectId?.v as string | undefined) ?? (ch.f.projectId as string | undefined);
    if (!projectId || !this.entities.has(entityKey('project', projectId))) return false;
    return atLeast(this.roleOf(userId, projectId), 'editor');
  }

  roleOf(userId: string, projectId: string): Role {
    const project = this.entities.get(entityKey('project', projectId));
    if (!project) return 'viewer';
    return effectiveRole(
      project.fields.roles?.v as Record<string, Role> | undefined,
      project.fields.defaultRole?.v as 'editor' | 'viewer' | undefined,
      userId,
    );
  }

  hasSeen(commitId: string): boolean {
    return this.seen.has(commitId);
  }

  has(e: EntityType, id: string): boolean {
    return this.entities.has(entityKey(e, id));
  }

  value(e: EntityType, id: string, field: string): unknown {
    return this.entities.get(entityKey(e, id))?.fields[field]?.v;
  }

  getCommits(): readonly Commit[] {
    return this.commits;
  }

  getRejected(commitId: string): Change[] | undefined {
    return this.rejected.get(commitId);
  }

  /** Builds the app's projects/tasks from the replayed state plus any
   * not-yet-written local edits. Local-only view state (collapsed rows,
   * pinned projects) is carried over from `prev`, and unchanged objects keep
   * their identity so React only re-renders what actually changed. */
  materialize(prev: Snapshot, overlay: Overlay): Snapshot {
    const view = new Map<string, { e: EntityType; id: string; f: Record<string, unknown> }>();
    for (const [key, ent] of this.entities) {
      const f: Record<string, unknown> = {};
      for (const [k, reg] of Object.entries(ent.fields)) f[k] = reg.v;
      view.set(key, { e: ent.e, id: ent.id, f });
    }
    for (const [key, pending] of overlay) {
      const base = view.get(key);
      view.set(key, { e: pending.e, id: pending.id, f: { ...(base?.f ?? {}), ...pending.f } });
    }

    const prevProjects = new Map(prev.projects.map((p) => [p.id, p]));
    const prevTasks = new Map(prev.tasks.map((t) => [t.id, t]));

    const tabsByProject = new Map<string, (NoteTab & { order: number })[]>();
    for (const ent of view.values()) {
      if (ent.e !== 'noteTab' || ent.f._deleted === true) continue;
      const projectId = str(ent.f.projectId, '');
      if (!projectId) continue;
      const list = tabsByProject.get(projectId) ?? [];
      list.push({
        id: ent.id,
        title: str(ent.f.title, 'Notes'),
        content: str(ent.f.content, ''),
        color: str(ent.f.color, DEFAULT_NOTE_TAB_COLOR),
        order: num(ent.f.order, 0),
      });
      tabsByProject.set(projectId, list);
    }

    const projects: Project[] = [];
    for (const ent of view.values()) {
      if (ent.e !== 'project' || ent.f._deleted === true) continue;
      const f = ent.f;
      const tabs = (tabsByProject.get(ent.id) ?? [])
        .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
        .map(({ order: _order, ...tab }) => tab);
      const before = prevProjects.get(ent.id);
      const project: Project = {
        id: ent.id,
        name: str(f.name, 'Untitled project'),
        color: str(f.color, PROJECT_COLORS[0]),
        createdAt: num(f.createdAt, 0),
        members: arr<string>(f.members),
        holidays: arr<string>(f.holidays),
        pinned: before?.pinned ?? false,
        archived: f.archived === true,
        noteTabs:
          tabs.length > 0
            ? tabs
            : // A stable id, so if two people start writing notes in a fresh
              // project at once they end up in the same tab.
              [{ id: `${ent.id}-notes`, title: 'Notes', content: '', color: DEFAULT_NOTE_TAB_COLOR }],
        customFieldDefs: arr<string>(f.customFieldDefs),
        useWorkingDays: f.useWorkingDays === true,
        roles: obj(f.roles) as Record<string, Role>,
        defaultRole: f.defaultRole === 'viewer' ? 'viewer' : 'editor',
      };
      projects.push(before && sameShallow(before, project) ? before : project);
    }
    projects.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
    const visibleProjectIds = new Set(projects.map((p) => p.id));

    const built: Task[] = [];
    for (const ent of view.values()) {
      if (ent.e !== 'task' || ent.f._deleted === true) continue;
      const f = ent.f;
      const projectId = str(f.projectId, '');
      if (!visibleProjectIds.has(projectId)) continue;
      built.push({
        id: ent.id,
        projectId,
        name: str(f.name, 'Untitled task'),
        start: str(f.start, ''),
        end: str(f.end, str(f.start, '')),
        progress: num(f.progress, 0),
        parentId: typeof f.parentId === 'string' ? f.parentId : null,
        order: num(f.order, 0),
        assignee: str(f.assignee, ''),
        color: str(f.color, PROJECT_COLORS[0]),
        isMilestone: f.isMilestone === true,
        collapsed: prevTasks.get(ent.id)?.collapsed ?? false,
        dependencies: arr<string>(f.dependencies),
        dependencyTypes: obj(f.dependencyTypes) as Task['dependencyTypes'],
        description: str(f.description, ''),
        attachments: arr<Task['attachments'][number]>(f.attachments),
        status: (str(f.status, 'not_started') as Task['status']),
        priority: (str(f.priority, 'medium') as Task['priority']),
        locked: f.locked === true,
        customFields: obj(f.customFields) as Record<string, string>,
      });
    }
    built.sort((a, b) => (a.id < b.id ? -1 : 1));
    repairTree(built);

    const tasks = built.map((t) => {
      const before = prevTasks.get(t.id);
      return before && sameShallow(before, t) ? before : t;
    });
    return { projects, tasks };
  }
}

/** Concurrent edits can leave a task pointing at a deleted parent, at a
 * parent in another project, into a parent cycle (A under B while someone
 * else put B under A), or depending on a deleted task. Fix all of that
 * deterministically so every client shows the same, fully reachable tree. */
function repairTree(tasks: Task[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) {
    if (t.parentId) {
      const parent = byId.get(t.parentId);
      if (!parent || parent.projectId !== t.projectId) t.parentId = null;
    }
  }
  for (const t of tasks) {
    const visited = new Set<string>([t.id]);
    let p = t.parentId;
    while (p) {
      if (visited.has(p)) {
        t.parentId = null;
        break;
      }
      visited.add(p);
      p = byId.get(p)?.parentId ?? null;
    }
  }
  for (const t of tasks) {
    if (t.dependencies.some((d) => !byId.has(d))) {
      t.dependencies = t.dependencies.filter((d) => byId.has(d));
    }
  }
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameShallow(a: object, b: object): boolean {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const k of keys) if (!sameValue(ra[k], rb[k])) return false;
  return true;
}
