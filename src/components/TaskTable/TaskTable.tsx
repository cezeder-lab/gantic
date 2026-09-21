import { forwardRef, useMemo } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { flattenVisible, filterFlatTasks } from '../../lib/taskTree';
import { TABLE_COL_WIDTHS, ROW_HEIGHT, HEADER_HEIGHT } from '../../lib/constants';
import { TaskRow } from './TaskRow';

interface Props {
  onScroll: (scrollTop: number) => void;
}

export const TaskTable = forwardRef<HTMLDivElement, Props>(function TaskTable({ onScroll }, ref) {
  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const tasks = useGanticStore((s) => s.tasks);
  const taskSort = useGanticStore((s) => s.taskSort);
  const taskFilterQuery = useGanticStore((s) => s.taskFilterQuery);
  const visibleColumns = useGanticStore((s) => s.visibleColumns);
  const addTask = useGanticStore((s) => s.addTask);

  const rows = useMemo(() => {
    if (!activeProjectId) return [];
    const flat = flattenVisible(tasks, activeProjectId, taskSort);
    return filterFlatTasks(flat, taskFilterQuery);
  }, [tasks, activeProjectId, taskSort, taskFilterQuery]);

  const visibleTaskIds = useMemo(() => rows.map((r) => r.task.id), [rows]);

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      <div
        ref={ref}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div
          className="sticky top-0 z-20 flex border-b border-gray-200 bg-[#f7f8fa] text-[11px] font-semibold uppercase tracking-wide text-gray-500"
          style={{ height: HEADER_HEIGHT }}
        >
          <HeaderCell width={TABLE_COL_WIDTHS.name} align="left" className="pl-3">
            Task name
          </HeaderCell>
          {visibleColumns.start && <HeaderCell width={TABLE_COL_WIDTHS.start}>Start</HeaderCell>}
          {visibleColumns.end && <HeaderCell width={TABLE_COL_WIDTHS.end}>End</HeaderCell>}
          {visibleColumns.duration && <HeaderCell width={TABLE_COL_WIDTHS.duration}>Duration</HeaderCell>}
          {visibleColumns.progress && <HeaderCell width={TABLE_COL_WIDTHS.progress}>Progress</HeaderCell>}
          {visibleColumns.assignee && <HeaderCell width={TABLE_COL_WIDTHS.assignee}>Assignee</HeaderCell>}
          {visibleColumns.status && <HeaderCell width={TABLE_COL_WIDTHS.status}>Status</HeaderCell>}
        </div>

        {rows.length === 0 && taskFilterQuery && (
          <p className="px-3 py-6 text-center text-sm text-gray-400">No tasks match "{taskFilterQuery}"</p>
        )}

        {rows.map(({ task, depth, hasChildren }) => (
          <TaskRow
            key={task.id}
            task={task}
            depth={depth}
            hasChildren={hasChildren}
            visibleColumns={visibleColumns}
            visibleTaskIds={visibleTaskIds}
          />
        ))}

        <button
          onClick={() => addTask({ parentId: null })}
          className="flex w-full items-center gap-2 px-3 text-left text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          style={{ height: ROW_HEIGHT }}
        >
          <span className="text-base leading-none">+</span> Add task
        </button>
      </div>
    </div>
  );
});

function HeaderCell({
  width,
  children,
  align = 'center',
  className = '',
}: {
  width: number;
  children: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center ${align === 'left' ? 'justify-start' : 'justify-center'} ${className}`}
      style={{ width }}
    >
      {children}
    </div>
  );
}
