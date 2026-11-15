export function documentTabIsRevealed(tab: {
  closest(selector: string): {
    getBoundingClientRect(): { left: number; right: number };
  } | null;
  getBoundingClientRect(): { left: number; right: number };
}) {
  const viewport = tab.closest('[data-tab-viewport]');
  if (!viewport) return false;
  const chip = tab.getBoundingClientRect();
  const frame = viewport.getBoundingClientRect();
  return chip.left >= frame.left - 1 && chip.right <= frame.right + 1;
}
