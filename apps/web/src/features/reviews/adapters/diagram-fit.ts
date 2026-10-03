import { Debouncer } from '@tanstack/pacer';
import { type RefObject, useEffect } from 'react';
import { REVIEW_DIAGRAM_FIT_WAIT_MS } from '@/config/limits';

export function useFitOnResize(
  host: RefObject<HTMLElement | null>,
  flow: { fitView: (options: { padding: number; maxZoom: number }) => unknown },
) {
  useEffect(() => {
    const element = host.current;
    if (element == null) return;
    const fit = new Debouncer(
      () => void flow.fitView({ padding: 0.06, maxZoom: 1 }),
      { wait: REVIEW_DIAGRAM_FIT_WAIT_MS },
    );
    const observer = new ResizeObserver(() => fit.maybeExecute());
    observer.observe(element);
    return () => {
      observer.disconnect();
      fit.cancel();
    };
  }, [host, flow]);
}
