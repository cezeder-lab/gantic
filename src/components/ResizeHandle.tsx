import { useRef } from 'react';
import { useGanticStore } from '../store/useGanticStore';

export function ResizeHandle() {
  const tableWidth = useGanticStore((s) => s.tableWidth);
  const setTableWidth = useGanticStore((s) => s.setTableWidth);
  const startRef = useRef({ x: 0, width: 0 });

  return (
    <div
      className="group/handle relative w-1 shrink-0 cursor-col-resize bg-gray-200"
      onMouseDown={(e) => {
        e.preventDefault();
        startRef.current = { x: e.clientX, width: tableWidth };
        const onMove = (ev: MouseEvent) => {
          setTableWidth(startRef.current.width + (ev.clientX - startRef.current.x));
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      }}
    >
      <div className="absolute inset-y-0 -left-1 -right-1 group-hover/handle:bg-[#4f7cff]/30" />
    </div>
  );
}
