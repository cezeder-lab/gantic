import type { Attachment, Project, Task } from '../types';
import { makeId } from './id';
import { getAttachmentBlob, saveAttachmentBlob } from './attachmentsDb';

const FORMAT_VERSION = 1;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

export async function exportProjectToJSON(project: Project, tasks: Task[]): Promise<string> {
  const attachments: Record<string, string> = {};
  for (const task of tasks) {
    for (const a of task.attachments) {
      const blob = await getAttachmentBlob(a.id);
      if (blob) attachments[a.id] = await blobToBase64(blob);
    }
  }
  const payload = { formatVersion: FORMAT_VERSION, exportedAt: Date.now(), project, tasks, attachments };
  return JSON.stringify(payload, null, 2);
}

export function downloadProjectJSON(project: Project, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '_')}.gantic.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function parseProjectImport(jsonText: string): Promise<{ project: Project; tasks: Task[] }> {
  let data: {
    project?: Partial<Project>;
    tasks?: Partial<Task>[];
    attachments?: Record<string, string>;
  };
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!data.project || !Array.isArray(data.tasks)) {
    throw new Error('This does not look like a Gantic project export.');
  }

  const idMap = new Map<string, string>();
  for (const t of data.tasks) if (t.id) idMap.set(t.id, makeId());
  const newProjectId = makeId();

  const project: Project = {
    id: newProjectId,
    name: `${data.project.name ?? 'Imported project'} (imported)`,
    color: data.project.color ?? '#4f7cff',
    createdAt: Date.now(),
    members: data.project.members ?? [],
    holidays: data.project.holidays ?? [],
  };

  const tasks: Task[] = [];
  for (const t of data.tasks) {
    if (!t.id || !t.name || !t.start || !t.end) continue;
    const newAttachments: Attachment[] = [];
    for (const a of t.attachments ?? []) {
      const base64 = data.attachments?.[a.id];
      const newAttachmentId = makeId();
      if (base64) {
        await saveAttachmentBlob(newAttachmentId, base64ToBlob(base64, a.mimeType));
      }
      newAttachments.push({ ...a, id: newAttachmentId });
    }
    tasks.push({
      id: idMap.get(t.id)!,
      projectId: newProjectId,
      name: t.name,
      start: t.start,
      end: t.end,
      progress: t.progress ?? 0,
      parentId: t.parentId ? (idMap.get(t.parentId) ?? null) : null,
      order: t.order ?? 0,
      assignee: t.assignee ?? '',
      color: t.color ?? '#4f7cff',
      isMilestone: t.isMilestone ?? false,
      collapsed: t.collapsed ?? false,
      dependencies: (t.dependencies ?? []).map((d) => idMap.get(d)).filter((d): d is string => !!d),
      description: t.description ?? '',
      attachments: newAttachments,
      status: t.status ?? 'not_started',
    });
  }

  return { project, tasks };
}
