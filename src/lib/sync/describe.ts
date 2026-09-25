import { TASK_PRIORITIES, TASK_STATUSES } from '../../types';
import type { Change, Commit } from './types';

const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  start: 'start date',
  end: 'end date',
  progress: 'progress',
  assignee: 'assignee',
  status: 'status',
  priority: 'priority',
  color: 'color',
  description: 'description',
  attachments: 'attachments',
  dependencies: 'dependencies',
  dependencyTypes: 'dependency types',
  isMilestone: 'milestone',
  locked: 'lock',
  customFields: 'custom fields',
  parentId: 'position in the outline',
  order: 'position in the outline',
  members: 'team members',
  holidays: 'non-working days',
  archived: 'archived',
  customFieldDefs: 'custom field list',
  useWorkingDays: 'working-days setting',
  roles: 'access',
  defaultRole: 'default access',
  title: 'title',
  content: 'text',
};

// Fields whose old/new values are too long or opaque to print inline.
const OPAQUE = new Set(['description', 'content', 'attachments', 'dependencies', 'dependencyTypes', 'customFields', 'color', 'holidays', 'customFieldDefs', 'parentId', 'order']);

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (field === 'status') return TASK_STATUSES.find((s) => s.value === v)?.label ?? String(v);
  if (field === 'priority') return TASK_PRIORITIES.find((p) => p.value === v)?.label ?? String(v);
  if (field === 'progress') return `${v}%`;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.join(', ') || '—';
  return String(v);
}

export type NameLookup = (e: Change['e'], id: string) => string | undefined;

function entityLabel(ch: Change, lookup: NameLookup): string {
  const name =
    (ch.f.name as string | undefined) ??
    (ch.f.title as string | undefined) ??
    (ch.prev?.name as string | undefined) ??
    (ch.prev?.title as string | undefined) ??
    lookup(ch.e, ch.id);
  const kind = ch.e === 'task' ? 'task' : ch.e === 'noteTab' ? 'note tab' : 'project';
  return name ? `${kind} "${name}"` : kind;
}

function describeRoles(prev: unknown, next: unknown, userName: (id: string) => string): string[] {
  const before = (prev && typeof prev === 'object' ? prev : {}) as Record<string, string>;
  const after = (next && typeof next === 'object' ? next : {}) as Record<string, string>;
  const out: string[] = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[id] === after[id]) continue;
    if (!after[id]) out.push(`removed ${userName(id)}'s specific access`);
    else out.push(`set ${userName(id)} as ${after[id]}`);
  }
  return out;
}

/** One line per change, e.g. `Changed status of task "Launch": In progress → Done`. */
export function describeChange(ch: Change, lookup: NameLookup, userName: (id: string) => string): string[] {
  const label = entityLabel(ch, lookup);
  if (ch.f._deleted === true) return [`Deleted ${label}`];
  if (ch.f._deleted === false && ch.prev?._deleted === true) return [`Restored ${label}`];
  if (!ch.prev) return [`Created ${label}`];

  const lines: string[] = [];
  const fields = Object.keys(ch.f).filter((k) => k !== '_deleted');
  if (fields.includes('parentId') || fields.includes('order')) lines.push(`Moved ${label} in the outline`);
  for (const k of fields) {
    if (k === 'parentId' || k === 'order') continue;
    if (k === 'roles') {
      for (const r of describeRoles(ch.prev[k], ch.f[k], userName)) lines.push(`On ${label}: ${r}`);
      continue;
    }
    if (k === 'projectId') continue;
    const what = FIELD_LABELS[k] ?? k;
    if (OPAQUE.has(k)) lines.push(`Edited ${what} of ${label}`);
    else if (k === 'name' || k === 'title') lines.push(`Renamed ${ch.e === 'task' ? 'task' : ch.e === 'noteTab' ? 'note tab' : 'project'} "${formatValue(k, ch.prev[k])}" → "${formatValue(k, ch.f[k])}"`);
    else lines.push(`Changed ${what} of ${label}: ${formatValue(k, ch.prev[k])} → ${formatValue(k, ch.f[k])}`);
  }
  return lines;
}

export function describeCommit(commit: Commit, lookup: NameLookup, userName: (id: string) => string): string[] {
  return commit.changes.flatMap((ch) => describeChange(ch, lookup, userName));
}
