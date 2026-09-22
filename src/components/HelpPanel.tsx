import { useGanticStore } from '../store/useGanticStore';

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: `${mod}+Z`, label: 'Undo' },
  { keys: `${mod}+Shift+Z / ${mod}+Y`, label: 'Redo' },
  { keys: `${mod}+D`, label: 'Duplicate selected task' },
  { keys: 'Delete / Backspace', label: 'Delete selected task(s)' },
  { keys: `${mod}+K`, label: 'Open global search' },
  { keys: `${mod}+Scroll`, label: 'Zoom the Gantt timeline' },
  { keys: 'Escape', label: 'Clear selection / close panels' },
  { keys: 'Shift+Click', label: 'Select a range of tasks' },
  { keys: `${mod}+Click`, label: 'Toggle a task in the selection' },
  { keys: 'Right-click', label: 'Open the context menu on a row or bar' },
  { keys: '?', label: 'Toggle this help panel' },
];

export function HelpPanel() {
  const helpOpen = useGanticStore((s) => s.helpOpen);
  const setHelpOpen = useGanticStore((s) => s.setHelpOpen);

  if (!helpOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setHelpOpen(false)} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">Keyboard shortcuts</h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm last:border-0">
              <span className="text-gray-600">{s.label}</span>
              <kbd className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-500">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
