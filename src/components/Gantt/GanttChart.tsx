import { forwardRef, useMemo, useRef, useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { flattenVisible, subtreeRange } from '../../lib/taskTree';
import { computeGanttRange } from '../../lib/ganttRange';
import { dayWidth, diffDays, isWeekend, parseISO, addDays, todayISO } from '../../lib/dates';
import { ROW_HEIGHT } from '../../lib/constants';
import { GanttHeader } from './GanttHeader';
import { TaskBar } from './TaskBar';
import { DependencyArrows, type BarPosition } from './DependencyArrows';

interface Props {
  onScroll: (scrollTop: number) => void;
  scrollLeftRef: React.MutableRefObject<number>;
}

export const GanttChart = forwardRef<HTMLDivElement, Props>(function GanttChart(
  { onScroll },
  ref,
) {
  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const tasks = useGanticStore((s) => s.tasks);
  const zoom = useGanticStore((s) => s.zoom);
  const addDependency = useGanticStore((s) => s.addDependency);
  const setSelectedTask = useGanticStore((s) => s.setSelectedTask);

  const contentRef = useRef<HTMLDivElement>(null);
  const [linking, setLinking] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const rows = useMemo(
    () => (activeProjectId ? flattenVisible(tasks, activeProjectId) : []),
    [tasks, activeProjectId],
  );
  const range = useMemo(() => computeGanttRange(tasks.filter((t) => t.projectId === activeProjectId), zoom), [tasks, activeProjectId, zoom]);
  const pxPerDay = dayWidth(zoom);
  const totalWidth = range.totalDays * pxPerDay;
  const totalHeight = Math.max(rows.length * ROW_HEIGHT, ROW_HEIGHT);

  const positions = useMemo(() => {
    const map = new Map<string, BarPosition>();
    rows.forEach(({ task, hasChildren }, idx) => {
      if (hasChildren) {
        const sub = subtreeRange(tasks, task.id);
        if (sub) {
          const x = diffDays(range.start, sub.start) * pxPerDay;
          const width = diffDays(sub.start, sub.end) * pxPerDay;
          map.set(task.id, { x, width, rowIndex: idx, isMilestone: false });
          return;
        }
      }
      const x = diffDays(range.start, task.start) * pxPerDay;
      const width = Math.max(diffDays(task.start, task.end) * pxPerDay, task.isMilestone ? 0 : 6);
      map.set(task.id, { x, width, rowIndex: idx, isMilestone: task.isMilestone });
    });
    return map;
  }, [rows, tasks, range.start, pxPerDay]);

  const weekendStripes = useMemo(() => {
    if (zoom !== 'day') return [];
    const stripes: { key: string; left: number }[] = [];
    for (let i = 0; i < range.totalDays; i++) {
      const d = parseISO(addDays(range.start, i));
      if (isWeekend(d)) stripes.push({ key: `wk-${i}`, left: i * pxPerDay });
    }
    return stripes;
  }, [range.start, range.totalDays, zoom, pxPerDay]);

  const todayX = useMemo(() => diffDays(range.start, todayISO()) * pxPerDay, [range.start, pxPerDay]);

  function relativePos(clientX: number, clientY: number) {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handleLinkStart(taskId: string, _edge: 'start' | 'end', clientX: number, clientY: number) {
    const pos = relativePos(clientX, clientY);
    setLinking({ sourceId: taskId, x: pos.x, y: pos.y });
    setCursorPos(pos);

    const onMove = (ev: MouseEvent) => {
      setCursorPos(relativePos(ev.clientX, ev.clientY));
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const targetEl = el?.closest('[data-task-id]') as HTMLElement | null;
      const targetId = targetEl?.getAttribute('data-task-id');
      if (targetId && targetId !== taskId) {
        addDependency(targetId, taskId);
      }
      setLinking(null);
      setCursorPos(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-white">
      <div
        ref={ref}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
        className="flex-1 overflow-auto"
        onClick={() => setSelectedTask(null)}
      >
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          <GanttHeader rangeStart={range.start} totalDays={range.totalDays} zoom={zoom} pxPerDay={pxPerDay} />

          <div ref={contentRef} className="relative" style={{ width: totalWidth, height: totalHeight }}>
            {weekendStripes.map((s) => (
              <div
                key={s.key}
                className="absolute top-0 bg-gray-50"
                style={{ left: s.left, width: pxPerDay, height: totalHeight }}
              />
            ))}

            {rows.map((_, idx) => (
              <div
                key={idx}
                className="absolute left-0 border-b border-gray-100"
                style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT, width: totalWidth }}
              />
            ))}

            {todayX >= 0 && todayX <= totalWidth && (
              <div
                className="pointer-events-none absolute top-0 z-10 w-px bg-[#ef5c6e]"
                style={{ left: todayX, height: totalHeight }}
              >
                <div className="absolute -left-[3px] -top-1 h-1.5 w-1.5 rounded-full bg-[#ef5c6e]" />
              </div>
            )}

            <DependencyArrows tasks={rows.map((r) => r.task)} positions={positions} totalWidth={totalWidth} totalHeight={totalHeight} />

            {rows.map(({ task, hasChildren }) => {
              const pos = positions.get(task.id)!;
              return (
                <div
                  key={task.id}
                  className="absolute left-0"
                  style={{ top: pos.rowIndex * ROW_HEIGHT, height: ROW_HEIGHT, width: totalWidth }}
                >
                  <TaskBar
                    task={task}
                    x={pos.x}
                    width={pos.width}
                    pxPerDay={pxPerDay}
                    rangeStart={range.start}
                    isSummary={hasChildren}
                    onLinkStart={handleLinkStart}
                  />
                </div>
              );
            })}

            {linking && cursorPos && (
              <svg className="pointer-events-none absolute left-0 top-0" width={totalWidth} height={totalHeight} style={{ overflow: 'visible' }}>
                <line
                  x1={linking.x}
                  y1={linking.y}
                  x2={cursorPos.x}
                  y2={cursorPos.y}
                  stroke="#4f7cff"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
