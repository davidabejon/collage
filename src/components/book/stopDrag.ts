import type { SyntheticEvent } from 'react'

/** Keeps pointer/key events inside controls from reaching the sortable card. */
export const stopDrag = {
  onMouseDown: (e: SyntheticEvent) => e.stopPropagation(),
  onTouchStart: (e: SyntheticEvent) => e.stopPropagation(),
  onKeyDown: (e: SyntheticEvent) => e.stopPropagation(),
}
