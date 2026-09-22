import type { Project, Task } from '../types';
import { makeId } from './id';
import { todayISO, addDays } from './dates';
import { TASK_COLORS, PROJECT_COLORS } from '../types';

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/**
 * Expects a header row with columns (case-insensitive, any order):
 * Name, Start, End, Assignee, Progress. Only Name is required — Start/End
 * default to today/today+3 if missing or unparsable. Produces a flat task
 * list (no hierarchy/dependencies — those aren't representable in a plain
 * CSV export from most tools).
 */
export function parseTasksCsv(csvText: string, projectName: string): { project: Project; tasks: Task[] } {
  const lines = csvText.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('This CSV file has no data rows.');

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    name: header.indexOf('name'),
    start: header.indexOf('start'),
    end: header.indexOf('end'),
    assignee: header.indexOf('assignee'),
    progress: header.indexOf('progress'),
  };
  if (idx.name === -1) throw new Error('The CSV must have a "Name" column.');

  const projectId = makeId();
  const today = todayISO();
  const tasks: Task[] = [];

  lines.slice(1).forEach((line, i) => {
    const cells = parseCsvLine(line);
    const name = cells[idx.name]?.trim();
    if (!name) return;

    const rawStart = idx.start !== -1 ? cells[idx.start]?.trim() : '';
    const rawEnd = idx.end !== -1 ? cells[idx.end]?.trim() : '';
    const start = /^\d{4}-\d{2}-\d{2}$/.test(rawStart) ? rawStart : today;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) && rawEnd >= start ? rawEnd : addDays(start, 3);
    const progressRaw = idx.progress !== -1 ? Number(cells[idx.progress]) : 0;

    tasks.push({
      id: makeId(),
      projectId,
      name,
      start,
      end,
      progress: Number.isFinite(progressRaw) ? Math.min(100, Math.max(0, progressRaw)) : 0,
      parentId: null,
      order: i,
      assignee: idx.assignee !== -1 ? (cells[idx.assignee]?.trim() ?? '') : '',
      color: TASK_COLORS[i % TASK_COLORS.length],
      isMilestone: false,
      collapsed: false,
      dependencies: [],
      dependencyTypes: {},
      description: '',
      attachments: [],
      status: 'not_started',
      priority: 'medium',
      locked: false,
      customFields: {},
    });
  });

  if (tasks.length === 0) throw new Error('No valid rows found in this CSV file.');

  const project: Project = {
    id: projectId,
    name: projectName.trim() || 'Imported project',
    color: PROJECT_COLORS[0],
    createdAt: Date.now(),
    members: [...new Set(tasks.map((t) => t.assignee).filter(Boolean))],
    holidays: [],
    pinned: false,
    archived: false,
    notes: '',
    customFieldDefs: [],
    useWorkingDays: false,
  };

  return { project, tasks };
}
