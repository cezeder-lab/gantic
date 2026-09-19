import { forwardRef } from 'react';
import { useGanticStore } from '../../store/useGanticStore';
import { flattenVisible } from '../../lib/taskTree';
import { TABLE_COL_WIDTHS, ROW_HEIGHT, HEADER_HEIGHT } from '../../lib/constants';
import { TaskRow } from './TaskRow';

interface Props {
  onScroll: (scrollTop: number) => void;
}

export const TaskTable = forwardRef<HTMLDivElement, Props>(function TaskTable({ onScroll }, ref) {
  const activeProjectId = useGanticStore((s) => s.activeProjectId);
  const tasks = useGanticStore((s) => s.tasks);
  const addTask = useGanticStore((s) => s.addTask);

  const rows = activeProjectId ? flattenVisible(tasks, activeProjectId) : [];

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
            Nom de la tâche
          </HeaderCell>
          <HeaderCell width={TABLE_COL_WIDTHS.start}>Début</HeaderCell>
          <HeaderCell width={TABLE_COL_WIDTHS.end}>Fin</HeaderCell>
          <HeaderCell width={TABLE_COL_WIDTHS.duration}>Durée</HeaderCell>
          <HeaderCell width={TABLE_COL_WIDTHS.progress}>Progrès</HeaderCell>
          <HeaderCell width={TABLE_COL_WIDTHS.assignee}>Assigné</HeaderCell>
        </div>

        {rows.map(({ task, depth, hasChildren }) => (
          <TaskRow key={task.id} task={task} depth={depth} hasChildren={hasChildren} />
        ))}

        <button
          onClick={() => addTask({ parentId: null })}
          className="flex w-full items-center gap-2 px-3 text-left text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          style={{ height: ROW_HEIGHT }}
        >
          <span className="text-base leading-none">+</span> Ajouter une tâche
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
