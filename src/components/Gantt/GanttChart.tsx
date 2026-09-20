import { forwardRef, useMemo, useRef, useState } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { flattenVisible, filterFlatTasks, subtreeRange } from '../../lib/taskTree';
import { computeGanttRange } from '../../lib/ganttRange';
import { computeCriticalPath } from '../../lib/criticalPath';
import { dayWidth, diffDays, isWeekend, parseISO, addDays, todayISO, getISOWeek } from '../../lib/dates';
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
  const taskSort = useGanticStore((s) => s.taskSort);
  const taskFilterQuery = useGanticStore((s) => s.taskFilterQuery);
  const showCriticalPath = useGanticStore((s) => s.showCriticalPath);
  const holidays = useGanticStore((s) => s.projects.find((p) => p.id === activeProjectId)?.holidays ?? []);
  const addDependency = useGanticStore((s) => s.addDependency);
  const setSelectedTask = useGanticStore((s) => s.setSelectedTask);

  const contentRef = useRef<HTMLDivElement>(null);
  const [linking, setLinking] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const rows = useMemo(() => {
    if (!activeProjectId) return [];
    const flat = flattenVisible(tasks, activeProjectId, taskSort);
    return filterFlatTasks(flat, taskFilterQuery);
  }, [tasks, activeProjectId, taskSort, taskFilterQuery]);

  const criticalIds = useMemo(
    () => (showCriticalPath && activeProjectId ? computeCriticalPath(tasks, activeProjectId) : new Set<string>()),
    [showCriticalPath, tasks, activeProjectId],
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

  const specialDayStripes = useMemo(() => {
    if (zoom !== 'day') return [];
    const stripes: { key: string; left: number; holiday: boolean }[] = [];
    for (let i = 0; i < range.totalDays; i++) {
      const dateStr = addDays(range.start, i);
      const d = parseISO(dateStr);
      const holiday = holidays.includes(dateStr);
      if (isWeekend(d) || holiday) stripes.push({ key: `wk-${i}`, left: i * pxPerDay, holiday });
    }
    return stripes;
  }, [range.start, range.totalDays, zoom, pxPerDay, holidays]);

  // Finer grid subdivisions than the header: a line per day in week view, a
  // line (with an ISO week number) per week in month view.
  const subGridLines = useMemo(() => {
    const lines: { key: string; left: number; label?: string }[] = [];
    if (zoom === 'week') {
      for (let i = 1; i < range.totalDays; i++) {
        lines.push({ key: `d-${i}`, left: i * pxPerDay });
      }
    } else if (zoom === 'month') {
      for (let i = 0; i <= range.totalDays; i += 7) {
        const d = parseISO(addDays(range.start, i));
        lines.push({ key: `w-${i}`, left: i * pxPerDay, label: `W${getISOWeek(d)}` });
      }
    }
    return lines;
  }, [zoom, range.start, range.totalDays, pxPerDay]);

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
            {specialDayStripes.map((s) => (
              <div
                key={s.key}
                className={s.holiday ? 'absolute top-0 bg-orange-50' : 'absolute top-0 bg-gray-50'}
                style={{ left: s.left, width: pxPerDay, height: totalHeight }}
              />
            ))}

            {subGridLines.map((line) => (
              <div
                key={line.key}
                className="pointer-events-none absolute top-0 border-l border-gray-100"
                style={{ left: line.left, height: totalHeight }}
              >
                {line.label && (
                  <span className="absolute left-1 top-0.5 text-[9px] font-medium text-gray-300">
                    {line.label}
                  </span>
                )}
              </div>
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
                    isCritical={criticalIds.has(task.id)}
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
