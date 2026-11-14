export const SWIPE_DISMISS_OFFSET = 120 // px dragged down
export const SWIPE_DISMISS_VELOCITY = 500 // px/s downward flick

/** Decide whether a downward drag-end should dismiss the sheet. */
export function shouldDismissOnDragEnd(offsetY: number, velocityY: number): boolean {
  return offsetY > SWIPE_DISMISS_OFFSET || velocityY > SWIPE_DISMISS_VELOCITY
}
