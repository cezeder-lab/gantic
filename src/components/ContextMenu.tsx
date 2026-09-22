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
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="fixed z-50 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-xl"
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
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-30 ${
              item.danger ? 'text-red-600' : 'text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
