import { useState } from 'react';

export function useRefChipLayout(refs: readonly string[]) {
  const [visibleCount, setVisibleCount] = useState(1);

  function row(container: HTMLDivElement | null) {
    if (!container) return;
    const measured = container.querySelector('[data-ref-measurement]');
    if (!measured) return;

    const update = () => {
      const widths = Array.from(
        measured.children,
        (chip) => chip.getBoundingClientRect().width,
      );
      const overflowWidth = widths.pop() ?? 0;
      const gap = Number.parseFloat(getComputedStyle(container).columnGap);
      const available = container.getBoundingClientRect().width;
      const total =
        widths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, widths.length - 1) * gap;
      if (total <= available) {
        setVisibleCount(refs.length);
        return;
      }
      let used = 0;
      let count = 0;
      for (const width of widths) {
        used += width + (count === 0 ? 0 : gap);
        const reserved = count + 1 === refs.length ? 0 : gap + overflowWidth;
        if (used + reserved > available) break;
        count += 1;
      }
      setVisibleCount(Math.max(1, count));
    };

    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(measured);
    update();
    return () => observer.disconnect();
  }

  return { row, visibleCount };
}
