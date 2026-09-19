export const ROW_HEIGHT = 36;
export const HEADER_ROW_HEIGHT = 26;
export const HEADER_HEIGHT = HEADER_ROW_HEIGHT * 2;

export const TABLE_COL_WIDTHS = {
  name: 260,
  start: 92,
  end: 92,
  duration: 64,
  progress: 100,
  assignee: 110,
};

export const TABLE_WIDTH =
  TABLE_COL_WIDTHS.name +
  TABLE_COL_WIDTHS.start +
  TABLE_COL_WIDTHS.end +
  TABLE_COL_WIDTHS.duration +
  TABLE_COL_WIDTHS.progress +
  TABLE_COL_WIDTHS.assignee +
  40; // grip + gutter
