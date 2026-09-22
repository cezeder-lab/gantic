import { useRef, useState } from 'react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { TASK_PRIORITIES } from '../../types';
import { useGanticStore } from '../../store/useGanticStore';
import { addDays, diffDays, formatShortDate } from '../../lib/dates';
import { ContextMenu, type ContextMenuItem } from '../ContextMenu';

type DragMode = 'move' | 'resize-start' | 'resize-end' | 'progress' | null;

interface Props {
  task: Task;
  x: number;
  width: number;
  pxPerDay: number;
  rangeStart: string;
  rowHeight: number;
  isSummary: boolean;
  isCritical?: boolean;
  onLinkStart?: (taskId: string, edge: 'start' | 'end', clientX: number, clientY: number) => void;
  onLinkEnd?: (taskId: string) => void;
}

export function TaskBar({ task, x, width, pxPerDay, rangeStart, rowHeight, isSummary, isCritical, onLinkStart, onLinkEnd }: Props) {
  const updateTask = useGanticStore((s) => s.updateTask);
  const deleteTask = useGanticStore((s) => s.deleteTask);
  const duplicateTask = useGanticStore((s) => s.duplicateTask);
  const openTaskDetails = useGanticStore((s) => s.openTaskDetails);
  const setSelectedTask = useGanticStore((s) => s.setSelectedTask);
  const selectedTaskId = useGanticStore((s) => s.selectedTaskId);
  const locked = task.locked;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  const contextMenuItems: ContextMenuItem[] = [
    { label: 'Open details', onClick: () => openTaskDetails(task.id) },
    { label: 'Duplicate', onClick: () => duplicateTask(task.id) },
    { label: locked ? 'Unlock' : 'Lock', onClick: () => updateTask(task.id, { locked: !locked }) },
    { label: 'Delete', onClick: () => deleteTask(task.id), danger: true, disabled: locked },
  ];

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTask(task.id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function beginDrag(mode: DragMode, e: React.MouseEvent) {
    if (locked) {
      e.stopPropagation();
      setSelectedTask(task.id);
      return;
    }
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
        style={{ left: x, width: Math.max(width, 6), top: rowHeight / 2 - 3, height: 6 }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTask(task.id);
        }}
        onContextMenu={handleContextMenu}
      >
        {contextMenu && (
          <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
        )}
        <div className="h-full w-full rounded-[2px] bg-gray-600" />
        <div
          className="absolute -left-[1px] top-full h-0 w-0 border-l-[4px] border-t-[5px] border-l-transparent"
          style={{ borderTopColor: '#4b5563' }}
        />
        <div
          className="absolute -right-[1px] top-full h-0 w-0 border-r-[4px] border-t-[5px] border-r-transparent"
          style={{ borderTopColor: '#4b5563' }}
        />
      </div>
    );
  }

  if (task.isMilestone) {
    return (
      <div
        data-task-id={task.id}
        className="absolute flex items-center justify-center"
        style={{ left: currentX - 8, top: rowHeight / 2 - 8, width: 16, height: 16 }}
        onMouseDown={(e) => beginDrag('move', e)}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={handleContextMenu}
        title={`${task.name} — ${formatShortDate(task.start)}`}
      >
        {contextMenu && (
          <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
        )}
        <div
          className={clsx(
            'h-3.5 w-3.5 rotate-45 border-2 border-white shadow',
            isSelected && 'ring-2 ring-offset-1 ring-[#4f7cff]',
            isCritical && 'outline outline-2 outline-offset-1 outline-[#ef5c6e]',
          )}
          style={{ backgroundColor: task.color }}
        />
      </div>
    );
  }

  const priorityColor = TASK_PRIORITIES.find((p) => p.value === task.priority)?.color;

  return (
    <div
      data-task-id={task.id}
      className="group/bar absolute flex items-center"
      style={{ left: currentX, width: currentWidth, top: rowHeight / 2 - 11, height: 22 }}
      onContextMenu={handleContextMenu}
    >
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />
      )}
      <div
        className={clsx(
          'relative h-full w-full overflow-hidden rounded-[5px] border shadow-sm',
          locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
          isSelected && 'ring-2 ring-offset-1 ring-[#4f7cff]',
          isCritical && 'outline outline-2 outline-offset-1 outline-[#ef5c6e]',
        )}
        style={{ backgroundColor: `${task.color}59`, borderColor: `${task.color}99` }}
        onMouseDown={(e) => beginDrag('move', e)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTask(task.id);
        }}
      >
        <div
          className="h-full rounded-[4px]"
          style={{ width: `${progress}%`, backgroundColor: task.color }}
        />
        {task.priority !== 'medium' && (
          <span
            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full border border-white/70"
            style={{ backgroundColor: priorityColor }}
            title={`Priority: ${task.priority}`}
          />
        )}
        {locked && (
          <span className="pointer-events-none absolute left-0.5 top-0.5 text-[9px] leading-none">🔒</span>
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center px-2 text-[11px] font-semibold mix-blend-normal">
          <span className="truncate" style={{ color: progress > 50 ? '#fff' : '#20242c' }}>
            {currentWidth >= 56 ? task.name : ''}
          </span>
        </span>

        {/* resize handles */}
        {!locked && (
          <>
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
          </>
        )}
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
        <span className="pointer-events-none ml-1.5 whitespace-nowrap text-[11px] text-gray-600 dark:text-gray-300">
          {task.name}
        </span>
      )}
    </div>
  );
}
