import { useState } from 'react';
import { stackMargin } from '../rules/margin-stack';

export function useMarginStack() {
  const [stack] = useState(createMarginStack);
  return stack;
}

function createMarginStack() {
  const cards = new Set<HTMLElement>();
  let frame = 0;
  const layout = () => {
    frame = 0;
    for (const card of cards) card.style.translate = '';
    const placed = [...cards].filter(
      (card) =>
        card.isConnected && getComputedStyle(card).position === 'absolute',
    );
    const offsets = stackMargin(
      placed.map((card) => {
        const box = card.getBoundingClientRect();
        return { top: box.top, height: box.height };
      }),
    );
    placed.forEach((card, index) => {
      const offset = offsets[index] ?? 0;
      if (offset > 0) card.style.translate = `0 ${offset}px`;
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(layout);
  };
  const observer = new ResizeObserver(schedule);
  return (card: HTMLElement) => {
    cards.add(card);
    observer.observe(card);
    if (card.offsetParent) observer.observe(card.offsetParent);
    schedule();
    return () => {
      cards.delete(card);
      if (cards.size > 0) return schedule();
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
    };
  };
}
