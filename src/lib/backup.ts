import type { Project, Task } from '../types';

const BACKUP_KEY = 'gantic-backups';
const MAX_BACKUPS = 8;

export interface Backup {
  timestamp: number;
  projects: Project[];
  tasks: Task[];
}

function readBackups(): Backup[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as Backup[]) : [];
  } catch {
    return [];
  }
}

export function listBackups(): Backup[] {
  return readBackups().sort((a, b) => b.timestamp - a.timestamp);
}

/** Snapshots the current projects/tasks as a rotating local backup, skipping
 * the write if nothing has changed since the last one. */
export function pushBackup(projects: Project[], tasks: Task[]) {
  const backups = readBackups();
  const last = backups[backups.length - 1];
  const serialized = JSON.stringify({ projects, tasks });
  if (last && JSON.stringify({ projects: last.projects, tasks: last.tasks }) === serialized) return;

  backups.push({ timestamp: Date.now(), projects, tasks });
  const trimmed = backups.slice(-MAX_BACKUPS);
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable — silently skip this backup.
  }
}

export function getBackup(timestamp: number): Backup | undefined {
  return readBackups().find((b) => b.timestamp === timestamp);
}
