export type DocumentTabBounds = { readonly x: number; readonly width: number };

export function documentTabLayout(
  viewport: number,
  content: number,
  offset: number,
  active?: DocumentTabBounds,
): { overflow: boolean; offset: number } {
  const overflow = viewport > 0 && content > viewport + 1;
  if (!overflow) return { overflow: false, offset: 0 };
  const end = content - viewport;
  let next = Math.max(0, Math.min(offset, end));
  if (active) {
    if (active.x < next || active.width > viewport) next = active.x;
    else if (active.x + active.width > next + viewport)
      next = active.x + active.width - viewport;
  }
  return { overflow, offset: Math.max(0, Math.min(next, end)) };
}
