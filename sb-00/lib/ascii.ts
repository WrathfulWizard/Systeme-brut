/**
 * ASCII matrix helpers.
 *
 * The handoff is explicit: the bar charts are "real monospace text, not
 * rendered charts dressed up to look like ASCII." These build the exact
 * filled/empty block strings the mockups use (█ / ░).
 */

const FILLED = '█';
const EMPTY = '░';

export interface AsciiRow {
  label: string;
  bar: string;
  value: string;
}

/**
 * Build a set of fixed-width bar rows scaled to the largest value in the set.
 * @param rows   label/value pairs
 * @param width  number of cells in each bar (default 16, matching the mockups)
 * @param max    optional explicit max (e.g. a goal) instead of the data max
 */
export function asciiBars(
  rows: { label: string; value: number; display: string }[],
  width = 16,
  max?: number,
): AsciiRow[] {
  const ceil = max ?? Math.max(...rows.map((r) => r.value), 1);
  const labelWidth = Math.max(...rows.map((r) => r.label.length));
  return rows.map((r) => {
    const filled = Math.max(0, Math.min(width, Math.round((r.value / ceil) * width)));
    return {
      label: r.label.padEnd(labelWidth),
      bar: FILLED.repeat(filled) + EMPTY.repeat(width - filled),
      value: r.display,
    };
  });
}
