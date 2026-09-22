import { useRef, useState } from 'react';
import { useGanticStore } from '../store/useGanticStore';

const FONT_SIZES: { value: string; label: string }[] = [
  { value: '2', label: 'Small' },
  { value: '3', label: 'Normal' },
  { value: '5', label: 'Large' },
  { value: '7', label: 'Huge' },
];

/** Notes saved before rich-text support are plain text — escape anything
 * that would be misread as a tag the first time it's rendered as HTML. */
function escapeIfPlainText(value: string): string {
  return /<[a-z][\s\S]*>/i.test(value)
    ? value
    : value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function NotesPanel() {
  const notesPanelOpen = useGanticStore((s) => s.notesPanelOpen);
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));

  if (!notesPanelOpen || !project) return null;

  return (
    <NotesPanelContent key={project.id} projectId={project.id} projectName={project.name} notes={project.notes} />
  );
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
  const dragRef = useRef({ y: 0, height: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialNotes.trim());
  // Frozen at mount: the editor is uncontrolled after that (all edits happen
  // directly in the DOM). Deriving dangerouslySetInnerHTML from the live
  // `notes` prop instead would make React re-apply innerHTML on every commit
  // (store update -> re-render), wiping the live selection mid-formatting.
  const initialHtmlRef = useRef(escapeIfPlainText(initialNotes));

  function commit() {
    if (editorRef.current) setProjectNotes(projectId, editorRef.current.innerHTML);
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    commit();
  }

  function execWithRestoredSelection(command: string, value?: string) {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    document.execCommand(command, false, value);
    commit();
  }

  function handleInput() {
    setIsEmpty(!(editorRef.current?.textContent ?? '').trim());
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent ?? '';
    const offset = range.startOffset;
    for (const idx of [offset, offset - 1]) {
      const ch = text[idx];
      if (ch === '☐' || ch === '☑') {
        node.textContent = text.slice(0, idx) + (ch === '☐' ? '☑' : '☐') + text.slice(idx + 1);
        commit();
        e.preventDefault();
        return;
      }
    }
  }

  function beginResize(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { y: e.clientY, height: notesPanelHeight };
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const delta = dragRef.current.y - ev.clientY;
      setNotesPanelHeight(dragRef.current.height + delta);
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
      className="flex shrink-0 flex-col border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 print:hidden"
      style={{ height: notesPanelHeight }}
    >
      <div
        className="group/handle relative h-1 shrink-0 cursor-row-resize bg-gray-200 dark:bg-gray-600"
        onMouseDown={beginResize}
      >
        <div className="absolute inset-x-0 -top-1 -bottom-1 group-hover/handle:bg-[#4f7cff]/30" />
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Notes — {projectName}
        </h3>
        <button
          onClick={() => setNotesPanelOpen(false)}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-gray-100 dark:border-gray-800 px-3 py-1.5">
        <ToolbarButton title="Bold" onClick={() => exec('bold')}>
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => exec('underline')}>
          <u>U</u>
        </ToolbarButton>

        <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-600" />

        <ToolbarButton title="Insert a checkbox" onClick={() => exec('insertText', '☐ ')}>
          ☐
        </ToolbarButton>
        <ToolbarButton title="Insert an exclamation mark" onClick={() => exec('insertText', '❗ ')}>
          ❗
        </ToolbarButton>

        <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-600" />

        <select
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            if (e.target.value) execWithRestoredSelection('fontSize', e.target.value);
            e.target.value = '';
          }}
          title="Text size"
          className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1 text-xs text-gray-600 dark:text-gray-300 outline-none"
        >
          <option value="" disabled>
            Size…
          </option>
          {FONT_SIZES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <input
          type="color"
          defaultValue="#20242c"
          onMouseDown={saveSelection}
          onChange={(e) => execWithRestoredSelection('foreColor', e.target.value)}
          title="Text color"
          className="h-6 w-7 cursor-pointer rounded border border-gray-200 dark:border-gray-700 p-0.5"
        />
      </div>

      <div className="relative min-h-0 flex-1">
        {isEmpty && (
          <span className="pointer-events-none absolute left-4 top-4 text-sm text-gray-400 dark:text-gray-500">
            Free-form notes, to-dos, things to track for this project…
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={commit}
          onClick={handleEditorClick}
          dangerouslySetInnerHTML={{ __html: initialHtmlRef.current }}
          className="h-full min-h-0 overflow-y-auto p-4 text-sm text-gray-700 dark:text-gray-200 outline-none"
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}
