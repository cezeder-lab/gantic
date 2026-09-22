import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  // Rendered into document.body (rather than inline where it's triggered
  // from, deep inside the scrollable task table) — position:fixed elements
  // nested in a scroll container are otherwise prone to stacking/paint
  // quirks in some browsers, since they no longer sit as a plain sibling of
  // the app's other top-level overlays.
  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="fixed z-50 w-48 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-xl"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 ${
              item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}
