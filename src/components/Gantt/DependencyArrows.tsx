import { ROW_HEIGHT } from '../../lib/constants';

export interface BarPosition {
  x: number;
  width: number;
  rowIndex: number;
  isMilestone: boolean;
}

interface Props {
  tasks: { id: string; dependencies: string[] }[];
  positions: Map<string, BarPosition>;
  totalWidth: number;
  totalHeight: number;
}

function buildPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const gap = 12;
  if (toX >= fromX + gap) {
    const midX = fromX + gap;
    return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
  }
  const midX1 = fromX + gap;
  const midX2 = toX - gap;
  const midY = fromY + (toY - fromY) / 2;
  return `M ${fromX} ${fromY} H ${midX1} V ${midY} H ${midX2} V ${toY} H ${toX}`;
}

export function DependencyArrows({ tasks, positions, totalWidth, totalHeight }: Props) {
  const paths: { key: string; d: string }[] = [];

  for (const task of tasks) {
    const to = positions.get(task.id);
    if (!to) continue;
    for (const depId of task.dependencies) {
      const from = positions.get(depId);
      if (!from) continue;

      const fromX = from.x + (from.isMilestone ? 8 : from.width);
      const fromY = from.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toX = to.x - (to.isMilestone ? 8 : 0) - (to.isMilestone ? 0 : 0);
      const toY = to.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

      paths.push({ key: `${depId}->${task.id}`, d: buildPath(fromX, fromY, toX - (to.isMilestone ? 0 : 1), toY) });
    }
  }

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={totalWidth}
      height={totalHeight}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker
          id="dep-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L0,6 L7,3 Z" fill="#9aa1b1" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke="#9aa1b1"
          strokeWidth={1.5}
          markerEnd="url(#dep-arrowhead)"
        />
      ))}
    </svg>
  );
}
