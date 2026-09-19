import type { Task, ZoomLevel } from '../types';
import { addDays, diffDays, parseISO, startOfWeek, toISO, todayISO } from './dates';

const PADDING_DAYS: Record<ZoomLevel, number> = {
  day: 7,
  week: 14,
  month: 45,
};

export interface GanttRange {
  start: string;
  totalDays: number;
}

export function computeGanttRange(tasks: Task[], zoom: ZoomLevel): GanttRange {
  const today = todayISO();
  let minStart = today;
  let maxEnd = addDays(today, 21);

  if (tasks.length > 0) {
    minStart = tasks.reduce((min, t) => (t.start < min ? t.start : min), tasks[0].start);
    maxEnd = tasks.reduce((max, t) => (t.end > max ? t.end : max), tasks[0].end);
  }

  const padding = PADDING_DAYS[zoom];
  const paddedStart = addDays(minStart, -padding);
  const paddedEnd = addDays(maxEnd, padding);

  const rangeStartDate = startOfWeek(parseISO(paddedStart));
  let rangeEndDate = startOfWeek(parseISO(paddedEnd));
  rangeEndDate.setDate(rangeEndDate.getDate() + 7);

  const start = toISO(rangeStartDate);
  const totalDays = diffDays(start, toISO(rangeEndDate));

  return { start, totalDays };
}

export function dateToX(dateStr: string, rangeStart: string, pxPerDay: number): number {
  return diffDays(rangeStart, dateStr) * pxPerDay;
}
