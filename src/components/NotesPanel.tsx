import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useGanticStore } from '../store/useGanticStore';
import { NOTE_TAB_COLORS } from '../types';
import type { NoteTab } from '../types';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';

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

function colorOf(value: string) {
  return NOTE_TAB_COLORS.find((c) => c.value === value) ?? NOTE_TAB_COLORS[0];
}

export function NotesPanel() {
  const notesPanelOpen = useGanticStore((s) => s.notesPanelOpen);
  const project = useGanticStore((s) => s.projects.find((p) => p.id === s.activeProjectId));

  if (!notesPanelOpen || !project) return null;

  return (
    <NotesPanelContent
      key={project.id}
      projectId={project.id}
      projectName={project.name}
      noteTabs={project.noteTabs}
    />
  );
}

function NotesPanelContent({
  projectId,
  projectName,
  noteTabs,
}: {
  projectId: string;
  projectName: string;
  noteTabs: NoteTab[];
}) {
  const notesPanelHeight = useGanticStore((s) => s.notesPanelHeight);
  const setNotesPanelHeight = useGanticStore((s) => s.setNotesPanelHeight);
  const setNotesPanelOpen = useGanticStore((s) => s.setNotesPanelOpen);
  const activeTabIdByProject = useGanticStore((s) => s.activeNoteTabId);
  const setActiveNoteTab = useGanticStore((s) => s.setActiveNoteTab);
  const addNoteTab = useGanticStore((s) => s.addNoteTab);
  const renameNoteTab = useGanticStore((s) => s.renameNoteTab);
  const setNoteTabColor = useGanticStore((s) => s.setNoteTabColor);
  const deleteNoteTab = useGanticStore((s) => s.deleteNoteTab);
  const dragRef = useRef({ y: 0, height: 0 });
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [colorPickerTabId, setColorPickerTabId] = useState<string | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const activeTab = noteTabs.find((t) => t.id === activeTabIdByProject[projectId]) ?? noteTabs[0];
  const activeColor = colorOf(activeTab.color);

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

  function startRename(tab: NoteTab) {
    setRenamingTabId(tab.id);
    setRenameValue(tab.title);
    setTabContextMenu(null);
  }

  function commitRename() {
    if (renamingTabId) renameNoteTab(projectId, renamingTabId, renameValue);
    setRenamingTabId(null);
  }

  const tabContextMenuItems: ContextMenuItem[] = tabContextMenu
    ? [
        {
          label: 'Rename',
          onClick: () => {
            const tab = noteTabs.find((t) => t.id === tabContextMenu.tabId);
            if (tab) startRename(tab);
          },
        },
        {
          label: 'Delete tab',
          danger: true,
          disabled: noteTabs.length <= 1,
          onClick: () => deleteNoteTab(projectId, tabContextMenu.tabId),
        },
      ]
    : [];

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

      <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-gray-100 dark:border-gray-800 px-3 pt-2">
        {noteTabs.map((tab) => {
          const color = colorOf(tab.color);
          const isActive = tab.id === activeTab.id;
          return (
            <div key={tab.id} className="relative shrink-0">
              {renamingTabId === tab.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingTabId(null);
                  }}
                  className="w-28 rounded-t-md border-0 bg-[var(--tab-bg)] px-3 py-1.5 text-xs font-medium text-[var(--tab-text)] outline-none ring-1 ring-[#4f7cff] dark:bg-[var(--tab-bg-dark)] dark:text-[var(--tab-text-dark)]"
                  style={
                    {
                      '--tab-bg': color.bg,
                      '--tab-bg-dark': color.bgDark,
                      '--tab-text': color.text,
                      '--tab-text-dark': color.textDark,
                    } as React.CSSProperties
                  }
                />
              ) : (
                <button
                  onClick={() => setActiveNoteTab(projectId, tab.id)}
                  onDoubleClick={() => startRename(tab)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                  }}
                  title="Click to switch, double-click to rename, right-click for more"
                  className={clsx(
                    'flex max-w-[10rem] items-center gap-1.5 rounded-t-md bg-[var(--tab-bg)] px-3 py-1.5 text-xs font-medium text-[var(--tab-text)] transition-opacity dark:bg-[var(--tab-bg-dark)] dark:text-[var(--tab-text-dark)]',
                    isActive ? 'opacity-100' : 'opacity-55 hover:opacity-85',
                  )}
                  style={
                    {
                      '--tab-bg': color.bg,
                      '--tab-bg-dark': color.bgDark,
                      '--tab-text': color.text,
                      '--tab-text-dark': color.textDark,
                    } as React.CSSProperties
                  }
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPickerTabId(colorPickerTabId === tab.id ? null : tab.id);
                    }}
                    title="Change color"
                    className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: color.bg }}
                  />
                  <span className="truncate">{tab.title}</span>
                </button>
              )}

              {colorPickerTabId === tab.id && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setColorPickerTabId(null)} />
                  <div className="absolute left-0 top-full z-30 mt-1 flex gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 shadow-lg">
                    {NOTE_TAB_COLORS.map((c) => (
                      <button
                        key={c.value}
                        title={c.label}
                        onClick={() => {
                          setNoteTabColor(projectId, tab.id, c.value);
                          setColorPickerTabId(null);
                        }}
                        className={clsx(
                          'h-5 w-5 rounded-full ring-1 ring-black/10 hover:scale-110',
                          tab.color === c.value && 'ring-2 ring-[#4f7cff]',
                        )}
                        style={{ backgroundColor: c.bg }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button
          onClick={() => addNoteTab(projectId)}
          title="New note tab"
          className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          +
        </button>
      </div>

      {tabContextMenu && (
        <ContextMenu
          x={tabContextMenu.x}
          y={tabContextMenu.y}
          items={tabContextMenuItems}
          onClose={() => setTabContextMenu(null)}
        />
      )}

      <NoteTabEditor
        key={activeTab.id}
        projectId={projectId}
        tabId={activeTab.id}
        content={activeTab.content}
        colorBg={activeColor.bg}
        colorBgDark={activeColor.bgDark}
      />
    </div>
  );
}

function NoteTabEditor({
  projectId,
  tabId,
  content: initialContent,
  colorBg,
  colorBgDark,
}: {
  projectId: string;
  tabId: string;
  content: string;
  colorBg: string;
  colorBgDark: string;
}) {
  const setNoteTabContent = useGanticStore((s) => s.setNoteTabContent);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialContent.trim());
  // Frozen at mount: the editor is uncontrolled after that (all edits happen
  // directly in the DOM). Deriving dangerouslySetInnerHTML from the live
  // content prop instead would make React re-apply innerHTML on every commit
  // (store update -> re-render), wiping the live selection mid-formatting.
  const initialHtmlRef = useRef(escapeIfPlainText(initialContent));

  function commit() {
    if (editorRef.current) setNoteTabContent(projectId, tabId, editorRef.current.innerHTML);
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

  return (
    <>
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

      <div
        className="relative min-h-0 flex-1"
        style={
          {
            '--tab-bg': colorBg,
            '--tab-bg-dark': colorBgDark,
          } as React.CSSProperties
        }
      >
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
          className="h-full min-h-0 overflow-y-auto bg-[var(--tab-bg)] p-4 text-sm text-gray-700 outline-none dark:bg-[var(--tab-bg-dark)] dark:text-gray-200"
        />
      </div>
    </>
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
