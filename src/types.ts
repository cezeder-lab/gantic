export type ZoomLevel = 'day' | 'week' | 'month';
export type TaskSortMode = 'manual' | 'dueDate' | 'assignee';
export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type DependencyType = 'FS' | 'SS' | 'FF';

export interface NoteTab {
  id: string;
  title: string;
  content: string; // HTML
  color: string; // key into NOTE_TAB_COLORS
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  members: string[];
  holidays: string[]; // ISO dates, non-working days shaded like weekends
  pinned: boolean;
  archived: boolean;
  noteTabs: NoteTab[];
  customFieldDefs: string[];
  useWorkingDays: boolean;
}

// Pastel, Post-it-style tab colors. `bg`/`text` are the light-mode swatch;
// `bgDark`/`textDark` keep the same hue recognizable against dark surfaces
// without glowing.
export const NOTE_TAB_COLORS: {
  value: string;
  label: string;
  bg: string;
  text: string;
  bgDark: string;
  textDark: string;
}[] = [
  { value: 'yellow', label: 'Yellow', bg: '#fff3b0', text: '#6b5900', bgDark: '#4a3f14', textDark: '#f5df8a' },
  { value: 'pink', label: 'Pink', bg: '#ffd6e7', text: '#83204f', bgDark: '#4a2436', textDark: '#f7a8c9' },
  { value: 'blue', label: 'Blue', bg: '#cfe8ff', text: '#0d4d80', bgDark: '#1e3350', textDark: '#9ac9f5' },
  { value: 'green', label: 'Green', bg: '#d7f5d0', text: '#1f5c1a', bgDark: '#25402a', textDark: '#a6dd9c' },
  { value: 'purple', label: 'Purple', bg: '#e6d9fb', text: '#4a2c85', bgDark: '#362a4a', textDark: '#c9aef2' },
  { value: 'orange', label: 'Orange', bg: '#ffe0bd', text: '#7a3d00', bgDark: '#4a341f', textDark: '#f5bd80' },
];

export const DEFAULT_NOTE_TAB_COLOR = NOTE_TAB_COLORS[0].value;

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
  dependencyTypes: Record<string, DependencyType>; // predecessor id -> type; missing = 'FS'
  description: string;
  attachments: Attachment[];
  status: TaskStatus;
  priority: TaskPriority;
  locked: boolean;
  customFields: Record<string, string>;
}

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not started', color: '#9aa1b1' },
  { value: 'in_progress', label: 'In progress', color: '#4f7cff' },
  { value: 'blocked', label: 'Blocked', color: '#ef5c6e' },
  { value: 'done', label: 'Done', color: '#2fb380' },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#9aa1b1' },
  { value: 'medium', label: 'Medium', color: '#f5a623' },
  { value: 'high', label: 'High', color: '#ef5c6e' },
];

export const DEPENDENCY_TYPES: { value: DependencyType; label: string }[] = [
  { value: 'FS', label: 'Finish → Start' },
  { value: 'SS', label: 'Start → Start' },
  { value: 'FF', label: 'Finish → Finish' },
];

export interface ColumnVisibility {
  start: boolean;
  end: boolean;
  duration: boolean;
  progress: boolean;
  assignee: boolean;
  status: boolean;
  priority: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  start: true,
  end: true,
  duration: true,
  progress: true,
  assignee: true,
  status: true,
  priority: false,
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
