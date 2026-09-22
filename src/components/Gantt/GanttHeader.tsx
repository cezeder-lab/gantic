import { useMemo } from 'react';
import type { ZoomLevel } from '../../types';
import {
  addDays,
  formatHeaderDay,
  formatMonthShort,
  formatMonthYear,
  isWeekend,
  parseISO,
  toISO,
} from '../../lib/dates';
import { HEADER_ROW_HEIGHT } from '../../lib/constants';

interface Segment {
  key: string;
  label: string;
  left: number;
  width: number;
  weekend?: boolean;
  isToday?: boolean;
}

function buildSegments(rangeStart: string, totalDays: number, zoom: ZoomLevel, pxPerDay: number) {
  const top: Segment[] = [];
  const bottom: Segment[] = [];
  const todayStr = toISO(new Date());

  if (zoom === 'day' || zoom === 'week') {
    const unitDays = zoom === 'day' ? 1 : 7;
    let cursorDay = 0;
    let monthStart = 0;
    let monthLabel = formatMonthYear(parseISO(rangeStart));

    while (cursorDay < totalDays) {
      const cellDate = addDays(rangeStart, cursorDay);
      const d = parseISO(cellDate);
      const label = zoom === 'day' ? formatHeaderDay(d) : `${formatMonthShort(d)} ${d.getDate()}`;
      bottom.push({
        key: cellDate,
        label,
        left: cursorDay * pxPerDay,
        width: unitDays * pxPerDay,
        weekend: zoom === 'day' && isWeekend(d),
        isToday: zoom === 'day' && cellDate === todayStr,
      });

      const nextMonthLabel = formatMonthYear(d);
      if (nextMonthLabel !== monthLabel) {
        top.push({
          key: `m-${monthStart}`,
          label: monthLabel,
          left: monthStart * pxPerDay,
          width: (cursorDay - monthStart) * pxPerDay,
        });
        monthStart = cursorDay;
        monthLabel = nextMonthLabel;
      }
      cursorDay += unitDays;
    }
    top.push({
      key: `m-${monthStart}`,
      label: monthLabel,
      left: monthStart * pxPerDay,
      width: (totalDays - monthStart) * pxPerDay,
    });
  } else {
    // month zoom
    let cursorDay = 0;
    let yearStart = 0;
    let yearLabel = parseISO(rangeStart).getFullYear();
    let d = parseISO(rangeStart);
    d.setDate(1);
    let dayOffset = 0;

    while (cursorDay < totalDays) {
      const monthDate = new Date(d);
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      const cellStartDay = cursorDay;
      const width = daysInMonth * pxPerDay;
      bottom.push({
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: formatMonthShort(monthDate),
        left: cellStartDay * pxPerDay,
        width,
      });

      if (monthDate.getFullYear() !== yearLabel) {
        top.push({
          key: `y-${yearStart}`,
          label: String(yearLabel),
          left: yearStart * pxPerDay,
          width: (cellStartDay - yearStart) * pxPerDay,
        });
        yearStart = cellStartDay;
        yearLabel = monthDate.getFullYear();
      }

      cursorDay += daysInMonth;
      dayOffset += daysInMonth;
      d = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
      void dayOffset;
    }
    top.push({
      key: `y-${yearStart}`,
      label: String(yearLabel),
      left: yearStart * pxPerDay,
      width: (totalDays - yearStart) * pxPerDay,
    });
  }

  return { top, bottom };
}

export function GanttHeader({
  rangeStart,
  totalDays,
  zoom,
  pxPerDay,
}: {
  rangeStart: string;
  totalDays: number;
  zoom: ZoomLevel;
  pxPerDay: number;
}) {
  const { top, bottom } = useMemo(
    () => buildSegments(rangeStart, totalDays, zoom, pxPerDay),
    [rangeStart, totalDays, zoom, pxPerDay],
  );

  const totalWidth = totalDays * pxPerDay;

  return (
    <div
      className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700 bg-[#f7f8fa] dark:bg-gray-800"
      style={{ width: totalWidth, height: HEADER_ROW_HEIGHT * 2 }}
    >
      <div className="relative border-b border-gray-100 dark:border-gray-800" style={{ height: HEADER_ROW_HEIGHT }}>
        {top.map((seg) => (
          <div
            key={seg.key}
            className="absolute top-0 flex items-center border-r border-gray-100 dark:border-gray-800 pl-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400"
            style={{ left: seg.left, width: seg.width, height: HEADER_ROW_HEIGHT }}
          >
            {seg.label}
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: HEADER_ROW_HEIGHT }}>
        {bottom.map((seg) => (
          <div
            key={seg.key}
            className={`absolute top-0 flex items-center justify-center border-r border-gray-100 dark:border-gray-800 text-[11px] ${
              seg.isToday ? 'font-bold text-[#ef5c6e]' : seg.weekend ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'
            }`}
            style={{ left: seg.left, width: seg.width, height: HEADER_ROW_HEIGHT }}
          >
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  );
}
