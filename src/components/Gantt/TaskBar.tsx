import { useRef, useState } from 'react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { useGanticStore } from '../../store/useGanticStore';
import { addDays, diffDays, formatShortDate } from '../../lib/dates';
import { ROW_HEIGHT } from '../../lib/constants';

type DragMode = 'move' | 'resize-start' | 'resize-end' | 'progress' | null;

interface Props {
  task: Task;
  x: number;
  width: number;
  pxPerDay: number;
  rangeStart: string;
  isSummary: boolean;
  onLinkStart?: (taskId: string, edge: 'start' | 'end', clientX: number, clientY: number) => void;
  onLinkEnd?: (taskId: string) => void;
}

export function TaskBar({ task, x, width, pxPerDay, rangeStart, isSummary, onLinkStart, onLinkEnd }: Props) {
  const updateTask = useGanticStore((s) => s.updateTask);
  const setSelectedTask = useGanticStore((s) => s.setSelectedTask);
  const selectedTaskId = useGanticStore((s) => s.selectedTaskId);

  const dragRef = useRef<{
    mode: DragMode;
    startClientX: number;
    origStartDay: number;
    origEndDay: number;
    origProgress: number;
  } | null>(null);

  const [preview, setPreview] = useState<{ startDay: number; endDay: number; progress: number } | null>(
    null,
  );
  const previewRef = useRef<typeof preview>(null);

  const isSelected = selectedTaskId === task.id;
  const origStartDay = diffDays(rangeStart, task.start);
  const origEndDay = diffDays(rangeStart, task.end);

  const startDay = preview?.startDay ?? origStartDay;
  const endDay = preview?.endDay ?? origEndDay;
  const progress = preview?.progress ?? task.progress;

  const currentX = startDay * pxPerDay;
  const currentWidth = Math.max((endDay - startDay) * pxPerDay, task.isMilestone ? 0 : 6);

  function beginDrag(mode: DragMode, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setSelectedTask(task.id);
    dragRef.current = {
      mode,
      startClientX: e.clientX,
      origStartDay,
      origEndDay,
      origProgress: task.progress,
    };

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaDays = Math.round((ev.clientX - d.startClientX) / pxPerDay);

      let next: { startDay: number; endDay: number; progress: number } | null = null;
      if (d.mode === 'move') {
        next = {
          startDay: d.origStartDay + deltaDays,
          endDay: d.origEndDay + deltaDays,
          progress: d.origProgress,
        };
      } else if (d.mode === 'resize-start') {
        const newStart = Math.min(d.origStartDay + deltaDays, d.origEndDay - (task.isMilestone ? 0 : 1));
        next = { startDay: newStart, endDay: d.origEndDay, progress: d.origProgress };
      } else if (d.mode === 'resize-end') {
        const newEnd = Math.max(d.origEndDay + deltaDays, d.origStartDay + (task.isMilestone ? 0 : 1));
        next = { startDay: d.origStartDay, endDay: newEnd, progress: d.origProgress };
      } else if (d.mode === 'progress') {
        const barWidth = (d.origEndDay - d.origStartDay) * pxPerDay || 1;
        const deltaPx = ev.clientX - d.startClientX;
        const newProgress = Math.min(100, Math.max(0, d.origProgress + (deltaPx / barWidth) * 100));
        next = { startDay: d.origStartDay, endDay: d.origEndDay, progress: Math.round(newProgress) };
      }
      previewRef.current = next;
      setPreview(next);
    };

    const onUp = () => {
      const p = dragRef.current;
      const finalPreview = previewRef.current;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (p && finalPreview) {
        if (p.mode === 'progress') {
          updateTask(task.id, { progress: finalPreview.progress });
        } else {
          updateTask(task.id, {
            start: addDays(rangeStart, finalPreview.startDay),
            end: addDays(rangeStart, finalPreview.endDay),
          });
        }
      }
      previewRef.current = null;
      setPreview(null);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  if (isSummary) {
    return (
      <div
        data-task-id={task.id}
        className="absolute flex items-center"
        style={{ left: x, width: Math.max(width, 6), top: ROW_HEIGHT / 2 - 7, height: 14 }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTask(task.id);
        }}
      >
        <div className="h-full w-full rounded-[3px] bg-gray-700" />
        <div
          className="absolute -left-[1px] top-full h-0 w-0 border-l-[6px] border-t-[6px] border-l-transparent"
          style={{ borderTopColor: '#374151' }}
        />
        <div
          className="absolute -right-[1px] top-full h-0 w-0 border-r-[6px] border-t-[6px] border-r-transparent"
          style={{ borderTopColor: '#374151' }}
        />
      </div>
    );
  }

  if (task.isMilestone) {
    return (
      <div
        data-task-id={task.id}
        className="absolute flex items-center justify-center"
        style={{ left: currentX - 8, top: ROW_HEIGHT / 2 - 8, width: 16, height: 16 }}
        onMouseDown={(e) => beginDrag('move', e)}
        onClick={(e) => e.stopPropagation()}
        title={`${task.name} — ${formatShortDate(task.start)}`}
      >
        <div
          className={clsx(
            'h-3.5 w-3.5 rotate-45 border-2 border-white shadow',
            isSelected && 'ring-2 ring-offset-1 ring-[#4f7cff]',
          )}
          style={{ backgroundColor: task.color }}
        />
      </div>
    );
  }

  return (
    <div
      data-task-id={task.id}
      className="group/bar absolute flex items-center"
      style={{ left: currentX, width: currentWidth, top: ROW_HEIGHT / 2 - 11, height: 22 }}
    >
      <div
        className={clsx(
          'relative h-full w-full cursor-grab overflow-hidden rounded-[5px] shadow-sm active:cursor-grabbing',
          isSelected && 'ring-2 ring-offset-1 ring-[#4f7cff]',
        )}
        style={{ backgroundColor: `${task.color}33` }}
        onMouseDown={(e) => beginDrag('move', e)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTask(task.id);
        }}
      >
        <div
          className="h-full rounded-[5px]"
          style={{ width: `${progress}%`, backgroundColor: task.color }}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center px-2 text-[11px] font-medium text-gray-800 mix-blend-normal">
          <span className="truncate" style={{ color: progress > 50 ? '#fff' : '#333' }}>
            {currentWidth >= 56 ? task.name : ''}
          </span>
        </span>

        {/* resize handles */}
        <div
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100"
          onMouseDown={(e) => beginDrag('resize-start', e)}
        >
          <div className="ml-0.5 mt-1 h-[16px] w-[3px] rounded bg-white/80" />
        </div>
        <div
          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100"
          onMouseDown={(e) => beginDrag('resize-end', e)}
        >
          <div className="ml-auto mr-0.5 mt-1 h-[16px] w-[3px] rounded bg-white/80" />
        </div>

        {/* progress handle */}
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-gray-700 opacity-0 shadow group-hover/bar:opacity-100"
          style={{ left: `calc(${progress}% - 5px)` }}
          onMouseDown={(e) => beginDrag('progress', e)}
        />

      </div>

      {/* link handles for dependency creation — siblings of the clipped bar so they aren't cut off at the edges */}
      {onLinkStart && (
        <>
          <div
            data-link-handle
            className="absolute -left-1.5 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 cursor-crosshair rounded-full border border-white bg-[#4f7cff] opacity-0 shadow group-hover/bar:opacity-100"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onLinkStart(task.id, 'start', e.clientX, e.clientY);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              onLinkEnd?.(task.id);
            }}
          />
          <div
            data-link-handle
            className="absolute -right-1.5 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 cursor-crosshair rounded-full border border-white bg-[#4f7cff] opacity-0 shadow group-hover/bar:opacity-100"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onLinkStart(task.id, 'end', e.clientX, e.clientY);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              onLinkEnd?.(task.id);
            }}
          />
        </>
      )}

      {currentWidth < 56 && (
        <span className="pointer-events-none ml-1.5 whitespace-nowrap text-[11px] text-gray-600">
          {task.name}
        </span>
      )}
    </div>
  );
}
