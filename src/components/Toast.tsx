import { useEffect } from 'react';
import { useGanticStore } from '../store/useGanticStore';

export function Toast() {
  const toast = useGanticStore((s) => s.toast);
  const dismissToast = useGanticStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 5000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-xl">
        <span>{toast.message}</span>
        {toast.onUndo && (
          <button
            onClick={() => {
              toast.onUndo?.();
              dismissToast();
            }}
            className="font-semibold text-[#8fb0ff] hover:text-white"
          >
            Undo
          </button>
        )}
        <button
          onClick={dismissToast}
          className="text-gray-400 hover:text-white"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
