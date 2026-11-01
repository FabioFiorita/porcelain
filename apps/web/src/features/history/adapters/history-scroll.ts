import type { UIEvent } from 'react';
import { useAtomValue } from '@effect/atom-react';
import type { historyPlace } from '@porcelain/client/history';
import { atomRegistry } from '@/shared/store';

export function useHistoryScroll(
  place: ReturnType<typeof historyPlace>,
  position: 'scrollOffset' | 'graphScrollOffset' = 'scrollOffset',
) {
  const registry = useAtomValue(atomRegistry);
  return {
    ref: (node: HTMLElement | null) => {
      if (!node) return;
      const viewport =
        node.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ??
        node;
      viewport.scrollTop = registry.get(place)[position];
    },
    onScrollCapture: (event: UIEvent<HTMLElement>) => {
      if (!(event.target instanceof HTMLElement)) return;
      registry.set(place, {
        ...registry.get(place),
        [position]: event.target.scrollTop,
      });
    },
  };
}
