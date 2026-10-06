import { Duration, Effect, Fiber, Queue, Stream } from 'effect';
import { type RefObject, useEffect } from 'react';
import { REVIEW_DIAGRAM_FIT_WAIT_MS } from '@/config/limits';

export function useFitOnResize(
  host: RefObject<HTMLElement | null>,
  flow: {
    fitView: (options: {
      padding: number;
      maxZoom: number;
    }) => Promise<boolean>;
  },
) {
  useEffect(() => {
    const element = host.current;
    if (element == null) return;
    const resized = Stream.callback<void>(
      (queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const observer = new ResizeObserver(() =>
              Queue.offerUnsafe(queue, undefined),
            );
            observer.observe(element);
            return observer;
          }),
          (observer) => Effect.sync(() => observer.disconnect()),
        ),
      { bufferSize: 1, strategy: 'sliding' },
    );
    const fit = Effect.runFork(
      resized.pipe(
        Stream.debounce(Duration.millis(REVIEW_DIAGRAM_FIT_WAIT_MS)),
        Stream.runForEach(() =>
          Effect.promise(() => flow.fitView({ padding: 0.06, maxZoom: 1 })),
        ),
      ),
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fit));
    };
  }, [host, flow]);
}
