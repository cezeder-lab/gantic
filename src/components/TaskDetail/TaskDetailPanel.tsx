import { useEffect, useMemo, useRef, useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { makeId } from '../../lib/id';
import { saveAttachmentBlob, getAttachmentBlob } from '../../lib/attachmentsDb';
import { formatShortDate } from '../../lib/dates';
import { DEPENDENCY_TYPES } from '../../types';
import type { Attachment, DependencyType, Task } from '../../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv') return '📊';
  return '📎';
}

export function TaskDetailPanel() {
  const detailsTaskId = useGanticStore((s) => s.detailsTaskId);
  const tasks = useGanticStore((s) => s.tasks);
  const task = useGanticStore((s) => s.tasks.find((t) => t.id === detailsTaskId));
  const project = useGanticStore((s) => s.projects.find((p) => p.id === task?.projectId));
  const dependencyTasks = useMemo(
    () => (task ? tasks.filter((t) => task.dependencies.includes(t.id)) : []),
    [task, tasks],
  );
  const closeTaskDetails = useGanticStore((s) => s.closeTaskDetails);
  const updateTask = useGanticStore((s) => s.updateTask);
  const addAttachment = useGanticStore((s) => s.addAttachment);
  const removeAttachment = useGanticStore((s) => s.removeAttachment);
  const removeDependency = useGanticStore((s) => s.removeDependency);
  const setDependencyType = useGanticStore((s) => s.setDependencyType);

  if (!task) return null;

  return (
    <TaskDetailPanelContent
      key={task.id}
      taskId={task.id}
      name={task.name}
      description={task.description}
      start={task.start}
      end={task.end}
      assignee={task.assignee}
      color={task.color}
      attachments={task.attachments}
      dependencies={dependencyTasks}
      dependencyTypes={task.dependencyTypes}
      projectName={project?.name ?? ''}
      onClose={closeTaskDetails}
      onUpdate={(patch) => updateTask(task.id, patch)}
      onAddAttachment={(a) => addAttachment(task.id, a)}
      onRemoveAttachment={(id) => removeAttachment(task.id, id)}
      onRemoveDependency={(depId) => removeDependency(task.id, depId)}
      onSetDependencyType={(depId, type) => setDependencyType(task.id, depId, type)}
    />
  );
}

interface ContentProps {
  taskId: string;
  name: string;
  description: string;
  start: string;
  end: string;
  assignee: string;
  color: string;
  attachments: Attachment[];
  dependencies: Task[];
  dependencyTypes: Record<string, DependencyType>;
  projectName: string;
  onClose: () => void;
  onUpdate: (patch: { name?: string; description?: string }) => void;
  onAddAttachment: (a: Attachment) => void;
  onRemoveAttachment: (id: string) => void;
  onRemoveDependency: (depId: string) => void;
  onSetDependencyType: (depId: string, type: DependencyType) => void;
}

function TaskDetailPanelContent({
  name: initialName,
  description: initialDescription,
  start,
  end,
  assignee,
  color,
  attachments,
  dependencies,
  dependencyTypes,
  projectName,
  onClose,
  onUpdate,
  onAddAttachment,
  onRemoveAttachment,
  onRemoveDependency,
  onSetDependencyType,
}: ContentProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [uploading, setUploading] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      for (const a of attachments) {
        if (!a.mimeType.startsWith('image/')) continue;
        const blob = await getAttachmentBlob(a.id);
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setThumbnails((prev) => ({ ...prev, [a.id]: url }));
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [attachments]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const id = makeId();
        await saveAttachmentBlob(id, file);
        onAddAttachment({
          id,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          addedAt: Date.now(),
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(attachment: Attachment) {
    const blob = await getAttachmentBlob(attachment.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {projectName}
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex items-start gap-2">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => onUpdate({ name })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="min-w-0 flex-1 rounded px-1 py-1 text-lg font-semibold text-gray-800 dark:text-gray-100 outline-none focus:bg-gray-50 dark:focus:bg-gray-800 focus:ring-1 focus:ring-blue-300"
            />
          </div>

          <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 pl-5 text-sm text-gray-500 dark:text-gray-400">
            <span>
              {formatShortDate(start)} → {formatShortDate(end)}
            </span>
            <span>{assignee || 'Unassigned'}</span>
          </div>

          {dependencies.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Depends on
              </h3>
              <ul className="space-y-1.5">
                {dependencies.map((dep) => (
                  <li
                    key={dep.id}
                    className="group flex items-center gap-2 rounded-md border border-gray-100 dark:border-gray-800 px-2.5 py-1.5"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dep.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{dep.name}</span>
                    <select
                      value={dependencyTypes[dep.id] ?? 'FS'}
                      onChange={(e) => onSetDependencyType(dep.id, e.target.value as DependencyType)}
                      title="Dependency type"
                      className="shrink-0 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-300"
                    >
                      {DEPENDENCY_TYPES.map((dt) => (
                        <option key={dt.value} value={dt.value}>
                          {dt.value}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => onRemoveDependency(dep.id)}
                      className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 group-hover:flex"
                      title="Remove dependency"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Description
            </h3>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => onUpdate({ description })}
              placeholder="Add notes, context or acceptance criteria…"
              rows={6}
              className="w-full resize-none rounded-md border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Attachments {attachments.length > 0 && `(${attachments.length})`}
              </h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : '+ Add file'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {attachments.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 dark:border-gray-700 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                No files attached yet
              </p>
            ) : (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="group flex items-center gap-2 rounded-md border border-gray-100 dark:border-gray-800 px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {thumbnails[a.id] ? (
                      <img
                        src={thumbnails[a.id]}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none">
                        {iconForMimeType(a.mimeType)}
                      </span>
                    )}
                    <button
                      onClick={() => handleDownload(a)}
                      className="min-w-0 flex-1 truncate text-left text-sm text-gray-700 dark:text-gray-200 hover:underline"
                      title="Download"
                    >
                      {a.name}
                    </button>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{formatFileSize(a.size)}</span>
                    <button
                      onClick={() => onRemoveAttachment(a.id)}
                      className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 group-hover:flex"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
