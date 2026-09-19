import type { ZoomLevel } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseISO(dateStr);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  const da = parseISO(a);
  const db = parseISO(b);
  return Math.round((db.getTime() - da.getTime()) / MS_PER_DAY);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export const DAY_WIDTH: Record<ZoomLevel, number> = {
  day: 36,
  week: 14,
  month: 4.4,
};

export function dayWidth(zoom: ZoomLevel): number {
  return DAY_WIDTH[zoom];
}

const MONTH_NAMES = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];
const MONTH_NAMES_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function formatShortDate(dateStr: string): string {
  const d = parseISO(dateStr);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function formatHeaderDay(date: Date): string {
  return String(date.getDate());
}

export function formatDayLabel(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES_FULL[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMonthShort(date: Date): string {
  return MONTH_NAMES[date.getMonth()];
}

export function clampMin1(days: number): number {
  return Math.max(1, days);
}
