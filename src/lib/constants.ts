export const ROW_HEIGHT = 36;
export const COMPACT_ROW_HEIGHT = 26;
export const HEADER_ROW_HEIGHT = 26;
export const HEADER_HEIGHT = HEADER_ROW_HEIGHT * 2;

export function getRowHeight(compact: boolean): number {
  return compact ? COMPACT_ROW_HEIGHT : ROW_HEIGHT;
}

export const TABLE_COL_WIDTHS = {
  name: 260,
  start: 92,
  end: 92,
  duration: 64,
  progress: 100,
  assignee: 110,
  status: 116,
  priority: 90,
};

export const TABLE_WIDTH =
  TABLE_COL_WIDTHS.name +
  TABLE_COL_WIDTHS.start +
  TABLE_COL_WIDTHS.end +
  TABLE_COL_WIDTHS.duration +
  TABLE_COL_WIDTHS.progress +
  TABLE_COL_WIDTHS.assignee +
  TABLE_COL_WIDTHS.status +
  TABLE_COL_WIDTHS.priority +
  40; // grip + gutter

export const NOTES_PANEL_HEIGHT = 240;
export const NOTES_PANEL_MIN_HEIGHT = 120;
export const NOTES_PANEL_MAX_HEIGHT = 640;
