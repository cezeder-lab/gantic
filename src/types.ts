export type ZoomLevel = 'day' | 'week' | 'month';
export type TaskSortMode = 'manual' | 'dueDate';
export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  members: string[];
  holidays: string[]; // ISO dates, non-working days shaded like weekends
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  addedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  start: string; // ISO date 'YYYY-MM-DD'
  end: string; // ISO date 'YYYY-MM-DD', inclusive
  progress: number; // 0-100
  parentId: string | null;
  order: number;
  assignee: string;
  color: string;
  isMilestone: boolean;
  collapsed: boolean;
  dependencies: string[]; // ids of predecessor tasks
  description: string;
  attachments: Attachment[];
  status: TaskStatus;
}

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not started', color: '#9aa1b1' },
  { value: 'in_progress', label: 'In progress', color: '#4f7cff' },
  { value: 'blocked', label: 'Blocked', color: '#ef5c6e' },
  { value: 'done', label: 'Done', color: '#2fb380' },
];

export interface ColumnVisibility {
  start: boolean;
  end: boolean;
  duration: boolean;
  progress: boolean;
  assignee: boolean;
  status: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  start: true,
  end: true,
  duration: true,
  progress: true,
  assignee: true,
  status: true,
};

export const TASK_COLORS = [
  '#4f7cff',
  '#7c5cff',
  '#2fb380',
  '#f5a623',
  '#ef5c6e',
  '#17b3c9',
  '#9c6ade',
  '#5c6ac4',
];

export const PROJECT_COLORS = [
  '#4f7cff',
  '#7c5cff',
  '#2fb380',
  '#f5a623',
  '#ef5c6e',
  '#17b3c9',
];

export type ViewMode = 'project' | 'dashboard';

/** A reusable task structure with day offsets instead of fixed dates, so it
 * can be applied starting from any date when creating a new project. */
export interface TemplateTask {
  id: string;
  name: string;
  startOffsetDays: number;
  durationDays: number;
  parentId: string | null;
  dependencies: string[];
  isMilestone: boolean;
  color: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  tasks: TemplateTask[];
}
