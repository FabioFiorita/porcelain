import { AtomRegistry } from 'effect/reactivity';

export function scheduledRegistry(defaultIdleTTL?: number) {
  const tasks: (() => void)[] = [];
  const registry = AtomRegistry.make({
    ...(defaultIdleTTL === undefined ? {} : { defaultIdleTTL }),
    scheduleTask: (task) => {
      tasks.push(task);
      return () => undefined;
    },
  });
  return {
    registry,
    flush: () => {
      for (const task of tasks.splice(0)) task();
    },
  };
}
