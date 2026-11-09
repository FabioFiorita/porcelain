import { useState } from 'react';
import { stackMargin } from '../rules/margin-stack';

export function useMarginStack() {
  const [reserve, setReserve] = useState(0);
  const [card] = useState(() => createMarginStack(setReserve));
  return { card, reserve };
}

function createMarginStack(onReserve: (pixels: number) => void) {
  const cards = new Set<HTMLElement>();
  let frame = 0;
  const layout = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    for (const card of cards) {
      card.style.translate = '';
    }
    const placed = [...cards].filter((card) => {
      const placed =
        card.isConnected && getComputedStyle(card).position === 'absolute';
      if (!placed) identifyMarginThreads(card, undefined);
      return placed;
    });
    const boxes = placed.map((card) => card.getBoundingClientRect());
    const offsets = stackMargin(
      boxes.map((box) => ({ top: box.top, height: box.height })),
    );
    let reserve = 0;
    placed.forEach((card, index) => {
      const offset = offsets[index] ?? 0;
      identifyMarginThreads(card, offset);
      if (offset > 0) card.style.translate = `0 ${offset}px`;
      const end = card.offsetParent?.getBoundingClientRect().bottom;
      const bottom = (boxes[index]?.bottom ?? 0) + offset;
      if (end !== undefined) reserve = Math.max(reserve, bottom - end);
    });
    onReserve(Math.ceil(reserve));
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(layout);
  };
  const observer = new ResizeObserver(layout);
  return (card: HTMLElement | null) => {
    if (!card) return;
    cards.add(card);
    observer.observe(card);
    if (card.offsetParent) observer.observe(card.offsetParent);
    schedule();
    return () => {
      cards.delete(card);
      observer.unobserve(card);
      if (cards.size > 0) return schedule();
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
      onReserve(0);
    };
  };
}

export function revealMarginLine(control: HTMLElement) {
  control
    .closest('diffs-container')
    ?.shadowRoot?.querySelector<HTMLElement>('[data-code] [data-selected-line]')
    ?.scrollIntoView({ block: 'center', inline: 'nearest' });
}

function identifyMarginThreads(card: HTMLElement, offset: number | undefined) {
  [...card.children].forEach((thread, index) => {
    if (thread instanceof HTMLElement)
      thread.dataset.displaced = String(
        offset !== undefined && (offset > 0 || index > 0),
      );
  });
}
