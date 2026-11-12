import { vi } from 'vitest';
import { AtomRegistry } from 'effect/reactivity';

export function createAtomClock() {
  vi.useFakeTimers();
  const registry = AtomRegistry.make({
    scheduleTask: (task) => {
      const timer = setTimeout(task, 0);
      return () => clearTimeout(timer);
    },
  });
  return {
    registry,
    advance: (milliseconds: number) =>
      vi.advanceTimersByTimeAsync(milliseconds),
    dispose() {
      registry.dispose();
      vi.useRealTimers();
    },
  };
}
