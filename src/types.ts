export type ZoomLevel = 'day' | 'week' | 'month';

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  members: string[];
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
}

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
