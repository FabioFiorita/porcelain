type Size = { width: number; height: number }

/** rn-primitives positions against the screen; menus must fit the app's window. */
export function menuInsets(screen: Size, window: Size) {
  return {
    top: 12,
    left: 12,
    right: Math.max(0, screen.width - window.width) + 12,
    bottom: Math.max(0, screen.height - window.height) + 12,
  }
}
