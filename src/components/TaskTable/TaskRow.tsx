import { useState } from 'react';
import clsx from 'clsx';
import { useGanticStore } from '../../store/useGanticStore';
import type { ColumnVisibility, Task } from '../../types';
import { TASK_COLORS, TASK_STATUSES } from '../../types';
import { TABLE_COL_WIDTHS, ROW_HEIGHT } from '../../lib/constants';
import { addDays, diffDays } from '../../lib/dates';

interface Props {
  task: Task;
  depth: number;
  hasChildren: boolean;
  visibleColumns: ColumnVisibility;
  visibleTaskIds: string[];
}

export function TaskRow({ task, depth, hasChildren, visibleColumns, visibleTaskIds }: Props) {
  const updateTask = useGanticStore((s) => s.updateTask);
  const deleteTask = useGanticStore((s) => s.deleteTask);
  const duplicateTask = useGanticStore((s) => s.duplicateTask);
  const toggleCollapse = useGanticStore((s) => s.toggleCollapse);
  const indentTask = useGanticStore((s) => s.indentTask);
  const outdentTask = useGanticStore((s) => s.outdentTask);
  const addTask = useGanticStore((s) => s.addTask);
  const selectedTaskIds = useGanticStore((s) => s.selectedTaskIds);
  const lastClickedTaskId = useGanticStore((s) => s.lastClickedTaskId);
  const setSelectedTask = useGanticStore((s) => s.setSelectedTask);
  const setRangeSelection = useGanticStore((s) => s.setRangeSelection);
  const toggleInSelection = useGanticStore((s) => s.toggleInSelection);
  const openTaskDetails = useGanticStore((s) => s.openTaskDetails);
  const members = useGanticStore((s) => s.projects.find((p) => p.id === task.projectId)?.members ?? []);

  const [name, setName] = useState(task.name);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const isSelected = selectedTaskIds.includes(task.id);
  const duration = diffDays(task.start, task.end);

  function handleRowClick(e: React.MouseEvent) {
    if (e.shiftKey && lastClickedTaskId) {
      const fromIdx = visibleTaskIds.indexOf(lastClickedTaskId);
      const toIdx = visibleTaskIds.indexOf(task.id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        setRangeSelection(visibleTaskIds.slice(lo, hi + 1), task.id);
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      toggleInSelection(task.id);
      return;
    }
    setSelectedTask(task.id);
  }

  return (
    <div
      data-row-task-id={task.id}
      className={clsx(
        'group flex items-center border-b border-gray-100 text-sm',
        isSelected ? 'bg-[#eef2ff]' : 'hover:bg-gray-50',
      )}
      style={{ height: ROW_HEIGHT }}
      onClick={handleRowClick}
    >
      <div
        className="flex shrink-0 items-center gap-1 overflow-hidden pl-1"
        style={{ width: TABLE_COL_WIDTHS.name, paddingLeft: 6 + depth * 18 }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey && lastClickedTaskId) {
              const fromIdx = visibleTaskIds.indexOf(lastClickedTaskId);
              const toIdx = visibleTaskIds.indexOf(task.id);
              if (fromIdx !== -1 && toIdx !== -1) {
                const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
                setRangeSelection(visibleTaskIds.slice(lo, hi + 1), task.id);
                return;
              }
            }
            toggleInSelection(task.id);
          }}
          title="Select for bulk actions (Shift-click for a range)"
          className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-[#4f7cff] focus:ring-[#4f7cff]"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(task.id);
          }}
          className={clsx(
            'flex h-4 w-4 shrink-0 items-center justify-center text-gray-400',
            !hasChildren && 'invisible',
          )}
        >
          <svg
            viewBox="0 0 8 8"
            className={clsx('h-2.5 w-2.5 fill-current transition-transform', !task.collapsed && 'rotate-90')}
          >
            <path d="M0 0L8 4L0 8Z" />
          </svg>
        </button>
        <span className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setColorPickerOpen((v) => !v);
            }}
            className="block h-2.5 w-2.5 rounded-full ring-offset-1 hover:ring-2 hover:ring-gray-300"
            style={{ backgroundColor: task.color }}
            title="Change color"
          />
          {colorPickerOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setColorPickerOpen(false)} />
              <div
                className="absolute left-0 top-5 z-30 flex w-32 flex-wrap gap-1.5 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {TASK_COLORS.map((c) => (
                  <button
                    key={c}
                    className={clsx(
                      'h-4 w-4 rounded-full border-2',
                      task.color === c ? 'border-gray-500' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      updateTask(task.id, { color: c });
                      setColorPickerOpen(false);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => updateTask(task.id, { name })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            'min-w-0 flex-1 truncate bg-transparent px-1 py-0.5 text-sm outline-none focus:rounded focus:bg-white focus:ring-1 focus:ring-blue-300',
            hasChildren && 'font-semibold text-gray-800',
          )}
        />

        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <IconButton title="Open details" onClick={() => openTaskDetails(task.id)}>
            ⤢
          </IconButton>
          <IconButton title="Add subtask" onClick={() => addTask({ parentId: task.id })}>
            +
          </IconButton>
          <IconButton title="Indent" onClick={() => indentTask(task.id)}>
            →
          </IconButton>
          <IconButton title="Outdent" onClick={() => outdentTask(task.id)} disabled={!task.parentId}>
            ←
          </IconButton>
          <IconButton title="Duplicate" onClick={() => duplicateTask(task.id)}>
            ⧉
          </IconButton>
          <IconButton title="Delete" onClick={() => deleteTask(task.id)}>
            ✕
          </IconButton>
        </div>
      </div>

      {visibleColumns.start && (
        <Cell width={TABLE_COL_WIDTHS.start}>
          <input
            type="date"
            value={task.start}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const newStart = e.target.value;
              const newEnd = newStart > task.end ? newStart : task.end;
              updateTask(task.id, { start: newStart, end: newEnd });
            }}
            className="w-full max-w-[86px] rounded border-none bg-transparent text-center text-xs text-gray-600 outline-none hover:bg-gray-100 focus:ring-1 focus:ring-blue-300"
          />
        </Cell>
      )}

      {visibleColumns.end && (
        <Cell width={TABLE_COL_WIDTHS.end}>
          <input
            type="date"
            value={task.end}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const newEnd = e.target.value;
              updateTask(task.id, { end: newEnd < task.start ? task.start : newEnd });
            }}
            className="w-full max-w-[86px] rounded border-none bg-transparent text-center text-xs text-gray-600 outline-none hover:bg-gray-100 focus:ring-1 focus:ring-blue-300"
          />
        </Cell>
      )}

      {visibleColumns.duration && (
        <Cell width={TABLE_COL_WIDTHS.duration}>
          <input
            type="number"
            min={0}
            value={duration}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const d = Math.max(0, Number(e.target.value) || 0);
              updateTask(task.id, { end: addDays(task.start, d) });
            }}
            className="w-10 rounded border-none bg-transparent text-center text-xs text-gray-600 outline-none hover:bg-gray-100 focus:ring-1 focus:ring-blue-300"
          />
        </Cell>
      )}

      {visibleColumns.progress && (
        <Cell width={TABLE_COL_WIDTHS.progress}>
          <div className="flex w-[84px] items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="h-1.5 w-9 shrink-0 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-[#4f7cff]" style={{ width: `${task.progress}%` }} />
            </div>
            <input
              type="number"
              min={0}
              max={100}
              value={task.progress}
              onChange={(e) =>
                updateTask(task.id, { progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
              }
              className="w-9 shrink-0 rounded border-none bg-transparent text-right text-xs text-gray-500 outline-none focus:ring-1 focus:ring-blue-300"
            />
            <span className="shrink-0 text-[10px] text-gray-400">%</span>
          </div>
        </Cell>
      )}

      {visibleColumns.assignee && (
        <Cell width={TABLE_COL_WIDTHS.assignee}>
          <select
            value={task.assignee}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateTask(task.id, { assignee: e.target.value })}
            className="w-full max-w-[100px] rounded border-none bg-transparent px-1 text-center text-xs text-gray-600 outline-none hover:bg-gray-100 focus:ring-1 focus:ring-blue-300"
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {task.assignee && !members.includes(task.assignee) && (
              <option value={task.assignee}>{task.assignee}</option>
            )}
          </select>
        </Cell>
      )}

      {visibleColumns.status && (
        <Cell width={TABLE_COL_WIDTHS.status}>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: TASK_STATUSES.find((s) => s.value === task.status)?.color }}
            />
            <select
              value={task.status}
              onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}
              className="w-full max-w-[92px] rounded border-none bg-transparent text-xs text-gray-600 outline-none hover:bg-gray-100 focus:ring-1 focus:ring-blue-300"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </Cell>
      )}
    </div>
  );
}

function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width }}>
      {children}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
