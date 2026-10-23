export type MarginBox = { readonly top: number; readonly height: number };

export const MARGIN_GAP = 12;

export function stackMargin(boxes: readonly MarginBox[], gap = MARGIN_GAP) {
  const offsets = boxes.map(() => 0);
  let floor = Number.NEGATIVE_INFINITY;
  for (const index of boxes
    .map((_, index) => index)
    .toSorted((a, b) => (boxes[a]?.top ?? 0) - (boxes[b]?.top ?? 0))) {
    const box = boxes[index];
    if (!box) continue;
    const offset = Math.max(0, floor - box.top);
    offsets[index] = offset;
    floor = box.top + offset + box.height + gap;
  }
  return offsets;
}
