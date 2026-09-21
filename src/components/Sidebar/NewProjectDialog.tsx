import { useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { todayISO } from '../../lib/dates';

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const templates = useGanticStore((s) => s.templates);
  const createProject = useGanticStore((s) => s.createProject);
  const createProjectFromTemplate = useGanticStore((s) => s.createProjectFromTemplate);
  const deleteTemplate = useGanticStore((s) => s.deleteTemplate);

  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [startDate, setStartDate] = useState(todayISO());

  function handleCreate() {
    if (templateId) {
      createProjectFromTemplate(templateId, name || 'New project', startDate);
    } else {
      createProject(name || 'New project');
    }
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">New project</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Project name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New project"
              autoFocus
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
            />
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Start from
            </span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
            >
              <option value="">Blank project</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  Template: {t.name}
                </option>
              ))}
            </select>
          </label>

          {templateId && (
            <>
              <label className="mb-1 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Start date
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
                />
              </label>
              <button
                onClick={() => {
                  if (confirm('Delete this template?')) {
                    deleteTemplate(templateId);
                    setTemplateId('');
                  }
                }}
                className="mt-1 text-xs text-red-500 hover:underline"
              >
                Delete this template
              </button>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="rounded-md bg-[#4f7cff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#3d68f0]"
          >
            Create
          </button>
        </div>
      </div>
    </>
  );
}
