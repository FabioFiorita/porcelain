import { afterEach } from 'vitest';
import type { Context } from 'effect';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { OperationStorage } from '../../src/features/git-actions/ports/operation-storage.ts';
import { operationStoreLayer } from '../../src/features/git-actions/store/operations.ts';
import { OperationStore } from '../../src/features/git-actions/ports/operation-store.ts';
const owned = new Set<ManagedRuntime.ManagedRuntime<OperationStore, never>>();
afterEach(async () => {
  const runtimes = [...owned];
  owned.clear();
  await Promise.all(runtimes.map((runtime) => runtime.dispose()));
});

export function operationStoreFixture(
  persistence?: {
    key: string;
    storage: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  },
  storage?: Context.Service.Shape<typeof OperationStorage>,
) {
  const runtime = ManagedRuntime.make(
    operationStoreLayer.pipe(
      Layer.provide(
        Layer.succeed(
          OperationStorage,
          storage ?? {
            read: () =>
              Effect.try(
                () => persistence?.storage.getItem(persistence.key) ?? null,
              ),
            write: (value) =>
              Effect.try(() =>
                persistence?.storage.setItem(persistence.key, value),
              ),
            clear: () =>
              Effect.try(() =>
                persistence?.storage.removeItem(persistence.key),
              ),
          },
        ),
      ),
    ),
  );
  owned.add(runtime);
  return { runtime, store: runtime.runSync(OperationStore) };
}
