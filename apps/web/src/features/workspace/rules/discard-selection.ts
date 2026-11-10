export function discardSelection(
  range:
    | {
        start: number;
        end: number;
        side?: 'additions' | 'deletions' | undefined;
        endSide?: 'additions' | 'deletions' | undefined;
      }
    | undefined,
) {
  if (
    !range ||
    range.side === 'deletions' ||
    (range.endSide !== undefined && range.endSide !== range.side)
  )
    return undefined;
  return {
    startLine: Math.min(range.start, range.end),
    endLine: Math.max(range.start, range.end),
  };
}
