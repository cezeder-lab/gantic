import { useRef, useState } from 'react';
import { useGanticStore } from '../store/useGanticStore';

export function NotesPanel() {
  const notesPanelOpen = useGanticStore((s) => s.notesPanelOpen);
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));

  if (!notesPanelOpen || !project) return null;

  return <NotesPanelContent key={project.id} projectId={project.id} projectName={project.name} notes={project.notes} />;
}

function NotesPanelContent({
  projectId,
  projectName,
  notes: initialNotes,
}: {
  projectId: string;
  projectName: string;
  notes: string;
}) {
  const notesPanelHeight = useGanticStore((s) => s.notesPanelHeight);
  const setNotesPanelHeight = useGanticStore((s) => s.setNotesPanelHeight);
  const setNotesPanelOpen = useGanticStore((s) => s.setNotesPanelOpen);
  const setProjectNotes = useGanticStore((s) => s.setProjectNotes);
  const startRef = useRef({ y: 0, height: 0 });
  const [notes, setNotes] = useState(initialNotes);

  function beginResize(e: React.MouseEvent) {
    e.preventDefault();
    startRef.current = { y: e.clientY, height: notesPanelHeight };
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const delta = startRef.current.y - ev.clientY;
      setNotesPanelHeight(startRef.current.height + delta);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      className="flex shrink-0 flex-col border-t border-gray-200 bg-white print:hidden"
      style={{ height: notesPanelHeight }}
    >
      <div
        className="group/handle relative h-1 shrink-0 cursor-row-resize bg-gray-200"
        onMouseDown={beginResize}
      >
        <div className="absolute inset-x-0 -top-1 -bottom-1 group-hover/handle:bg-[#4f7cff]/30" />
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Notes — {projectName}
        </h3>
        <button
          onClick={() => setNotesPanelOpen(false)}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="Close"
        >
          ✕
        </button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => setProjectNotes(projectId, notes)}
        placeholder="Notes libres, to-do, points à suivre pour ce projet…"
        className="min-h-0 flex-1 resize-none border-none p-4 text-sm text-gray-700 outline-none"
      />
    </div>
  );
}
