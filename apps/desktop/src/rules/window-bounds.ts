type Rectangle = { x: number; y: number; width: number; height: number };
type WindowState = { bounds: Rectangle; maximized: boolean };

export function restoreWindowBounds(
  state: WindowState | undefined,
  displays: readonly WindowState['bounds'][],
  minimum: { width: number; height: number },
): WindowState | undefined {
  if (state === undefined) return undefined;
  const { bounds } = state;
  if (bounds.width < minimum.width || bounds.height < minimum.height)
    return undefined;
  return displays.some(
    (display) =>
      bounds.x >= display.x &&
      bounds.y >= display.y &&
      bounds.x + bounds.width <= display.x + display.width &&
      bounds.y + bounds.height <= display.y + display.height,
  )
    ? state
    : undefined;
}
