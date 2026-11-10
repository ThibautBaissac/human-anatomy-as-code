// Placement rules of the overlays: hover label, phone bottom sheet. Pure.
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

/** Gap between the cursor and the hover label (px). */
export const LABEL_OFFSET = 14;

/** Top-left of the hover label: right of and below the cursor, flipped left or above at the window edges. */
export function labelPlacement(cursor: Point, label: Size, viewport: Size): { left: number; top: number } {
  let left = cursor.x + LABEL_OFFSET, top = cursor.y + LABEL_OFFSET;
  if (left + label.width > viewport.width) left = cursor.x - LABEL_OFFSET - label.width;
  if (top + label.height > viewport.height) top = cursor.y - LABEL_OFFSET - label.height;
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

export type SheetHeight = 'folded' | 'half' | 'full';
export const SHEET_FOLDED_PX = 96;
export const PHONE_HEADER_PX = 56;

/** The three heights of the phone sheet for a window height. */
export function sheetHeights(windowHeight: number): Record<SheetHeight, number> {
  return { folded: SHEET_FOLDED_PX, half: Math.round(windowHeight / 2), full: windowHeight - PHONE_HEADER_PX };
}

/** The height a dragged sheet settles at: the nearest one (the lower on a tie). */
export function snapSheet(height: number, heights: Record<SheetHeight, number>): SheetHeight {
  const order: SheetHeight[] = ['folded', 'half', 'full'];
  return order.reduce((best, h) => (Math.abs(heights[h] - height) < Math.abs(heights[best] - height) ? h : best));
}

export const nextSheet = (h: SheetHeight): SheetHeight => (h === 'folded' ? 'half' : h === 'half' ? 'full' : 'folded');
